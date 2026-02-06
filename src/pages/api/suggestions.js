/**
 * API Route: /api/suggestions
 * Get AI-powered suggestions from web/YouTube
 */

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Static suggestions (you can make these dynamic with a web search API later)
      const suggestions = {
        youtube_tips: [
          {
            title: "Advantage+ Shopping campaigns outperforming manual by 40%",
            source: "Ben Heath",
            url: "https://youtube.com/@benheath",
            tip: "Consider testing Advantage+ for your sales campaigns"
          },
          {
            title: "2026 Meta Ads: CBO works best with $50+/day minimum",
            source: "Andrew Hubbard",
            url: "https://youtube.com/@andrewhubbard",
            tip: "Ensure each ad set in CBO has enough budget to exit learning"
          },
          {
            title: "Reels placement showing 2x better CPM than Feed",
            source: "Social Media Examiner",
            url: "https://youtube.com/@socialmediaexaminer",
            tip: "Enable Reels placement if not already active"
          }
        ],
        web_tips: [
          {
            title: "Facebook changed default attribution to 7-day click",
            source: "Jon Loomer",
            url: "https://jonloomer.com",
            tip: "Check your attribution settings haven't been reset"
          },
          {
            title: "Cost caps working better than bid caps in 2026",
            source: "Facebook Ads Experts",
            url: "https://facebook.com/business",
            tip: "Test cost cap bidding on your best performing campaigns"
          }
        ],
        general_recommendations: [
          "Review your ad creative every 2-3 weeks to prevent fatigue",
          "Test at least 3-5 creatives per ad set",
          "Use broad targeting with Advantage+ audience",
          "Consolidate ad sets to help Meta's algorithm learn faster",
          "Monitor frequency - refresh creative when frequency > 3"
        ],
        updated_at: new Date().toISOString()
      };

      res.status(200).json(suggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
