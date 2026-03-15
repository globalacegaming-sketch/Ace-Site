import { Router, Request, Response } from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent';
import { requireAgentAuth } from '../middleware/agentAuth';

const router = Router();

// ────────────────────────────────────────────────────────────
// POST /analytics/events  — batch ingest events (public, no auth)
// ────────────────────────────────────────────────────────────
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, message: 'events array required' });
    }

    const capped = events.slice(0, 50);
    const docs = capped.map((e: any) => ({
      userId: e.userId || undefined,
      sessionId: e.sessionId || 'unknown',
      eventName: e.eventName,
      category: e.category || 'page',
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      pageUrl: e.pageUrl,
      pagePath: e.pagePath,
      featureName: e.featureName,
      elementId: e.elementId,
      elementText: e.elementText?.substring(0, 100),
      properties: e.properties,
      device: e.device,
      browser: e.browser,
      os: e.os,
      country: e.country,
      screenWidth: e.screenWidth,
      screenHeight: e.screenHeight,
      referrer: e.referrer,
      duration: e.duration,
      scrollDepth: e.scrollDepth,
    }));

    await AnalyticsEvent.insertMany(docs, { ordered: false });
    return res.json({ success: true, inserted: docs.length });
  } catch (error: any) {
    console.error('Analytics ingest error:', error.message);
    return res.status(500).json({ success: false, message: 'Ingest failed' });
  }
});

// ────────────────────────────────────────────────────────────
// Helper: parse date range from query
// ────────────────────────────────────────────────────────────
function getDateRange(query: any): { start: Date; end: Date } {
  const end = query.endDate ? new Date(query.endDate as string) : new Date();
  const start = query.startDate
    ? new Date(query.startDate as string)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

// ────────────────────────────────────────────────────────────
// GET /analytics/overview  — key metrics (agent auth)
// ────────────────────────────────────────────────────────────
router.get('/overview', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req.query);
    const match = { timestamp: { $gte: start, $lte: end } };

    const [
      totalEvents,
      uniqueUsers,
      uniqueSessions,
      pageViews,
      avgDuration,
      conversionEvents,
      onboardingStarted,
      onboardingCompleted,
    ] = await Promise.all([
      AnalyticsEvent.countDocuments(match),
      AnalyticsEvent.distinct('userId', match).then((r) => r.filter(Boolean).length),
      AnalyticsEvent.distinct('sessionId', match).then((r) => r.length),
      AnalyticsEvent.countDocuments({ ...match, eventName: 'page_view' }),
      AnalyticsEvent.aggregate([
        { $match: { ...match, eventName: 'time_spent_on_page', duration: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$duration' } } },
      ]).then((r) => r[0]?.avg || 0),
      AnalyticsEvent.countDocuments({ ...match, eventName: 'payment_completed' }),
      AnalyticsEvent.countDocuments({ ...match, eventName: 'onboarding_started' }),
      AnalyticsEvent.countDocuments({ ...match, eventName: 'onboarding_completed' }),
    ]);

    const conversionRate =
      uniqueUsers > 0 ? Math.round((conversionEvents / uniqueUsers) * 10000) / 100 : 0;
    const onboardingRate =
      onboardingStarted > 0
        ? Math.round((onboardingCompleted / onboardingStarted) * 10000) / 100
        : 0;

    return res.json({
      success: true,
      data: {
        totalEvents,
        uniqueUsers,
        uniqueSessions,
        pageViews,
        avgSessionDuration: Math.round(avgDuration),
        conversionRate,
        onboardingCompletionRate: onboardingRate,
      },
    });
  } catch (error: any) {
    console.error('Analytics overview error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /analytics/traffic  — traffic over time (daily)
// ────────────────────────────────────────────────────────────
router.get('/traffic', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req.query);

    const pipeline = [
      { $match: { timestamp: { $gte: start, $lte: end }, eventName: 'page_view' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          pageViews: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          sessions: { $addToSet: '$sessionId' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          pageViews: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          sessions: { $size: '$sessions' },
        },
      },
      { $sort: { date: 1 as 1 } },
    ];

    const data = await AnalyticsEvent.aggregate(pipeline);
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Analytics traffic error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /analytics/pages  — top pages
// ────────────────────────────────────────────────────────────
router.get('/pages', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req.query);

    const data = await AnalyticsEvent.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end }, eventName: 'page_view', pagePath: { $exists: true } } },
      {
        $group: {
          _id: '$pagePath',
          views: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 0,
          page: '$_id',
          views: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
        },
      },
      { $sort: { views: -1 as -1 } },
      { $limit: 20 },
    ]);

    // Get avg duration per page
    const durations = await AnalyticsEvent.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end }, eventName: 'time_spent_on_page', pagePath: { $exists: true } } },
      { $group: { _id: '$pagePath', avgDuration: { $avg: '$duration' } } },
    ]);
    const durMap = new Map(durations.map((d) => [d._id, Math.round(d.avgDuration)]));

    const enriched = data.map((p) => ({ ...p, avgDuration: durMap.get(p.page) || 0 }));
    return res.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('Analytics pages error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /analytics/features  — feature usage
// ────────────────────────────────────────────────────────────
router.get('/features', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req.query);

    const data = await AnalyticsEvent.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end }, category: 'feature', featureName: { $exists: true } } },
      {
        $group: {
          _id: '$featureName',
          uses: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          events: { $push: '$eventName' },
        },
      },
      {
        $project: {
          _id: 0,
          feature: '$_id',
          uses: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          failures: {
            $size: { $filter: { input: '$events', as: 'e', cond: { $eq: ['$$e', 'feature_failed'] } } },
          },
        },
      },
      { $sort: { uses: -1 as -1 } },
      { $limit: 20 },
    ]);

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Analytics features error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /analytics/clicks  — click analytics
// ────────────────────────────────────────────────────────────
router.get('/clicks', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req.query);

    const [topClicks, rageClicks, clicksByPage] = await Promise.all([
      AnalyticsEvent.aggregate([
        { $match: { timestamp: { $gte: start, $lte: end }, category: 'click', elementText: { $exists: true, $ne: '' } } },
        { $group: { _id: { text: '$elementText', id: '$elementId' }, clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 as -1 } },
        { $limit: 15 },
        { $project: { _id: 0, element: '$_id.text', elementId: '$_id.id', clicks: 1 } },
      ]),
      AnalyticsEvent.countDocuments({
        timestamp: { $gte: start, $lte: end },
        eventName: 'rage_click_detected',
      }),
      AnalyticsEvent.aggregate([
        { $match: { timestamp: { $gte: start, $lte: end }, category: 'click' } },
        { $group: { _id: '$pagePath', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 as -1 } },
        { $limit: 10 },
        { $project: { _id: 0, page: '$_id', clicks: 1 } },
      ]),
    ]);

    return res.json({ success: true, data: { topClicks, rageClicks, clicksByPage } });
  } catch (error: any) {
    console.error('Analytics clicks error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /analytics/funnel  — funnel analysis
// ────────────────────────────────────────────────────────────
router.get('/funnel', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req.query);
    const match = { timestamp: { $gte: start, $lte: end } };

    const steps = [
      { name: 'Landing Page', event: 'page_view' },
      { name: 'Sign Up', event: 'signup_completed' },
      { name: 'Email Verified', event: 'email_verified' },
      { name: 'First Deposit', event: 'first_deposit' },
      { name: 'First Game', event: 'first_game_played' },
      { name: 'Returned (Day 2+)', event: 'return_visit' },
    ];

    const counts = await Promise.all(
      steps.map((s) =>
        AnalyticsEvent.distinct('userId', { ...match, eventName: s.event }).then((r) => r.filter(Boolean).length)
      )
    );

    const data = steps.map((s, i) => ({
      step: s.name,
      event: s.event,
      users: counts[i],
      rate: counts[0] > 0 ? Math.round((counts[i] / counts[0]) * 10000) / 100 : 0,
      dropOff: i > 0 && counts[i - 1] > 0
        ? Math.round(((counts[i - 1] - counts[i]) / counts[i - 1]) * 10000) / 100
        : 0,
    }));

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Analytics funnel error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /analytics/dropoff  — drop-off detection
// ────────────────────────────────────────────────────────────
router.get('/dropoff', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req.query);
    const match = { timestamp: { $gte: start, $lte: end } };

    // Exit pages - last page_view in each session
    const exitPages = await AnalyticsEvent.aggregate([
      { $match: { ...match, eventName: 'page_view' } },
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$sessionId', lastPage: { $first: '$pagePath' } } },
      { $group: { _id: '$lastPage', exits: { $sum: 1 } } },
      { $sort: { exits: -1 as -1 } },
      { $limit: 10 },
      { $project: { _id: 0, page: '$_id', exits: 1 } },
    ]);

    // Abandoned flows
    const abandonedFlows = await AnalyticsEvent.aggregate([
      { $match: { ...match, eventName: { $regex: /abandoned|checkout_abandoned|onboarding_abandoned/ } } },
      { $group: { _id: '$eventName', count: { $sum: 1 } } },
      { $sort: { count: -1 as -1 } },
      { $project: { _id: 0, flow: '$_id', count: 1 } },
    ]);

    // Bounce rate (sessions with only 1 page view)
    const sessionCounts = await AnalyticsEvent.aggregate([
      { $match: { ...match, eventName: 'page_view' } },
      { $group: { _id: '$sessionId', pages: { $sum: 1 } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          bounced: { $sum: { $cond: [{ $eq: ['$pages', 1] }, 1, 0] } },
        },
      },
    ]);

    const bounceRate =
      sessionCounts[0]?.total > 0
        ? Math.round((sessionCounts[0].bounced / sessionCounts[0].total) * 10000) / 100
        : 0;

    return res.json({ success: true, data: { exitPages, abandonedFlows, bounceRate } });
  } catch (error: any) {
    console.error('Analytics dropoff error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /analytics/devices  — device/browser breakdown
// ────────────────────────────────────────────────────────────
router.get('/devices', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { start, end } = getDateRange(req.query);
    const match = { timestamp: { $gte: start, $lte: end }, eventName: 'page_view' };

    const [devices, browsers] = await Promise.all([
      AnalyticsEvent.aggregate([
        { $match: { ...match, device: { $exists: true } } },
        { $group: { _id: '$device', count: { $sum: 1 } } },
        { $sort: { count: -1 as -1 } },
        { $project: { _id: 0, name: '$_id', count: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { ...match, browser: { $exists: true } } },
        { $group: { _id: '$browser', count: { $sum: 1 } } },
        { $sort: { count: -1 as -1 } },
        { $limit: 8 },
        { $project: { _id: 0, name: '$_id', count: 1 } },
      ]),
    ]);

    return res.json({ success: true, data: { devices, browsers } });
  } catch (error: any) {
    console.error('Analytics devices error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

export default router;
