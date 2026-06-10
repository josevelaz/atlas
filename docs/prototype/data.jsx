// Sample mail data for Atlas prototype
const SAMPLE = {
  screener: [
    {
      id: "s1",
      from: "Maya Chen",
      addr: "maya.chen@northstarcap.com",
      subject: "Intro — angel check for your seed round",
      preview: "Hi! I was forwarded your deck by Jamie. Quick context — I write $25–100k checks into developer infrastructure and have led seed rounds at three companies in your space. Would love 20 minutes this week if you have time.",
      time: "9:14",
      aiHint: "Looks like a warm investor intro. Recommend Inbox.",
      aiCategory: "inbox",
    },
    {
      id: "s2",
      from: "ResonateHQ",
      addr: "team@resonate.so",
      subject: "Your monthly product digest — May edition",
      preview: "What shipped this month: AI Recap 2.0, retro themes, a redesigned project sidebar, and 14 small fixes. Read the full changelog →",
      time: "8:02",
      aiHint: "Marketing newsletter. Recommend Feed.",
      aiCategory: "feed",
    },
    {
      id: "s3",
      from: "Stripe",
      addr: "receipts@stripe.com",
      subject: "Receipt from Linear — $96.00",
      preview: "Your payment of $96.00 to Linear has been processed. View receipt and invoice details below.",
      time: "7:31",
      aiHint: "Transactional receipt. Recommend Paper Trail.",
      aiCategory: "paper",
    },
    {
      id: "s4",
      from: "Liam Park",
      addr: "liam@bluegrouseaudio.co",
      subject: "Quick question about your guitar pickup wiring",
      preview: "Hey — saw your post on the Reverb forum about humbucker rewiring. I'm doing a similar swap on a 2003 Tele and wondered if you ran into the same grounding issue with the bridge plate.",
      time: "Wed",
      aiHint: "Personal cold email. Recommend Inbox.",
      aiCategory: "inbox",
    },
  ],

  inbox: [
    { id: "i1", from: "Priya Ramanathan", addr: "priya@atlas.co", subject: "Re: Q3 hiring plan — final review", preview: "I went through the latest version. Two things stood out. First, the engineering pod size is still off relative to what we projected in February. Second, I think we should move the design hire forward by six weeks given the roadmap.", time: "10:42", unread: true, selected: true, priority: 1, tags: ["reply-later"] },
    { id: "i2", from: "Marcus Okafor", addr: "marcus@catalystfund.vc", subject: "Term sheet — redlines attached", preview: "Attached are our redlines on the SAFE. Most of it is standard, but flag the pro-rata language — happy to walk through on a call tomorrow.", time: "10:18", unread: true, priority: 1, tags: ["reply-later"] },
    { id: "i3", from: "Sara Bouchard", addr: "sara@atlas.co", subject: "Stale design review — needs your input", preview: "The thread on the screener empty state has been waiting on you for 3 days. Not blocking yet but Thursday is the cutoff.", time: "9:55", unread: true, priority: 2 },
    { id: "i4", from: "Dad", addr: "rwbarrett@protonmail.com", subject: "Thanksgiving — flight question", preview: "Are you flying in Wednesday night or Thursday morning? Your mother wants to know whether to grab the airport pickup or send me.", time: "9:30", priority: 3, tags: ["set-aside"] },
    { id: "i5", from: "Jordan Vega", addr: "jordan.vega@atlas.co", subject: "Pull request #482 — auth refactor", preview: "Pushed the third revision. The session token edge case is fixed and I added a regression test. Ready for one more look when you have a minute.", time: "Wed", priority: 2 },
    { id: "i6", from: "GitHub", addr: "noreply@github.com", subject: "[atlas/core] 3 new mentions in pull requests", preview: "@you was mentioned in #491, #492, and #493. Latest: Jordan Vega left a review on #491 with 2 comments.", time: "Wed", priority: 3 },
    { id: "i7", from: "Anya Volkov", addr: "anya@silvercreekdesign.com", subject: "Following up — illustration commission", preview: "Hi! Circling back on the brand illustrations for the marketing site. I have a slot opening up in two weeks if you'd like to move forward.", time: "Tue", priority: 2, tags: ["reply-later"] },
    { id: "i8", from: "Calendly", addr: "no-reply@calendly.com", subject: "New event: Maya Chen on Friday at 2:30 PM", preview: "Maya Chen scheduled a 20-minute intro call for Friday, May 23 at 2:30 PM PT. Zoom link included.", time: "Tue", priority: 3 },
    { id: "i9", from: "Toni Reyes", addr: "toni@atlas.co", subject: "Re: AI assistant copy pass", preview: "First pass attached. I leaned plain and utilitarian like we talked about — let me know what reads off.", time: "Mon", priority: 3 },
  ],

  feed: [
    { id: "f1", from: "Stratechery", addr: "ben@stratechery.com", subject: "The platform shift nobody wants to talk about", preview: "Three years into the AI reset, the platform layer is more contested than it has ever been. This week's update covers the implications for incumbent SaaS, the new browser wars, and what it means for the apps you build on top.", time: "11:02", unread: true },
    { id: "f2", from: "Vercel", addr: "team@vercel.com", subject: "What's new — May 2026", preview: "Edge functions are now 40% faster. Framework support expanded to four new frameworks. Plus a new pricing tier for solo developers.", time: "9:00" },
    { id: "f3", from: "Substack — Anne Helen Petersen", addr: "annehelen@substack.com", subject: "On the quiet end of friendship", preview: "A reader writes in about a 15-year friendship that didn't end so much as fade. I want to talk about the unique kind of grief that lives there.", time: "8:14", unread: true },
    { id: "f4", from: "Figma", addr: "news@figma.com", subject: "Config 2026 — the lineup is here", preview: "Three days. Sixty-eight talks. Headliners from Pixar, Anthropic, and Glossier. Early-bird pricing ends Friday.", time: "Wed" },
    { id: "f5", from: "Morning Brew", addr: "crew@morningbrew.com", subject: "Markets: tariffs round 4, and what changed", preview: "Good morning. The fourth round of tariffs landed at midnight. Equities opened soft, the dollar firmed up against the yen, and oil is doing oil things.", time: "Wed" },
    { id: "f6", from: "The Browser", addr: "newsletter@thebrowser.com", subject: "Five articles worth your morning", preview: "Why glass keeps getting thinner. A neurosurgeon's case against helmet laws. The forgotten history of municipal compost. Plus two more.", time: "Tue" },
    { id: "f7", from: "Linear", addr: "team@linear.app", subject: "Changelog — Cycles 2.0, Initiatives, dark contrast theme", preview: "We rebuilt cycles from the ground up, shipped Initiatives for cross-team work, and added a high-contrast dark theme by popular request.", time: "Mon" },
  ],

  paper: [
    { id: "p1", from: "Stripe", addr: "receipts@stripe.com", subject: "Receipt from Linear — $96.00", preview: "Payment processed. Card ending 4242. Period: May 20 — Jun 20.", time: "7:31", tags: ["receipt"] },
    { id: "p2", from: "Delta", addr: "deltaairlines@delta.com", subject: "Your flight confirmation — DL 482 to PDX", preview: "Confirmation #JK4Z9P. Departs SFO Wed Nov 26 at 6:14 PM. Seat 14C. Check in 24 hrs prior.", time: "Wed", tags: ["confirmation"] },
    { id: "p3", from: "Amazon", addr: "auto-confirm@amazon.com", subject: "Shipped: Your order of \"Cable Management Sleeve\"", preview: "Arriving Friday, May 23. Track package in app or via the link below.", time: "Wed", tags: ["shipping"] },
    { id: "p4", from: "Brex", addr: "no-reply@brex.com", subject: "Card statement available — May 2026", preview: "Statement balance: $4,128.42. Due Jun 14. Auto-pay enabled.", time: "Tue", tags: ["statement"] },
    { id: "p5", from: "PG&E", addr: "donotreply@pge.com", subject: "Your bill is ready — $84.12", preview: "Billing period Apr 17 — May 16. Due Jun 2.", time: "Tue", tags: ["bill"] },
    { id: "p6", from: "Notion", addr: "team@notion.so", subject: "Receipt — Notion AI add-on", preview: "Thanks for your payment of $20.00. Period: May 18 — Jun 18.", time: "Mon", tags: ["receipt"] },
    { id: "p7", from: "DoorDash", addr: "no-reply@doordash.com", subject: "Order delivered — Tartine Bakery", preview: "Your order was delivered at 8:42 AM. Total $24.18.", time: "Mon", tags: ["receipt"] },
  ],

  threadBody: {
    i1: {
      from: "Priya Ramanathan",
      addr: "priya@atlas.co",
      time: "Today, 10:42 AM",
      messages: [
        {
          from: "Priya Ramanathan", addr: "priya@atlas.co", initial: "PR", time: "Yesterday, 6:14 PM",
          body: [
            "Quick note before I forget — I'm pulling together the Q3 hiring plan and want to lock the engineering pod sizes by Friday.",
            "Sending the draft over tonight. Two open questions: do we still want the design hire in pod B, and are we comfortable holding the platform pod at four for another quarter?",
          ],
        },
        {
          from: "You", addr: "rob@atlas.co", initial: "RB", time: "Today, 8:30 AM",
          body: [
            "Sounds good. Will look at it this morning. Holding platform at four is fine with me — the bottleneck is review capacity, not heads.",
          ],
        },
        {
          from: "Priya Ramanathan", addr: "priya@atlas.co", initial: "PR", time: "Today, 10:42 AM",
          body: [
            "I went through the latest version. Two things stood out.",
            "First, the engineering pod size is still off relative to what we projected in February. We had said pod A would grow to seven by end of Q3 — the new draft has six. Was that intentional, or did one of the reqs get rolled into pod C?",
            "Second, I think we should move the design hire forward by six weeks. The marketing site rebuild is going to need brand work earlier than we modeled, and Sara is at capacity. Can we discuss in our 1:1 tomorrow?",
          ],
        },
      ],
      aiSummary: "Priya is reviewing the Q3 hiring plan and has two concerns: (1) pod A is one head short of the February projection — she's asking if it was rolled into pod C, and (2) she wants to move the design hire up by six weeks because the marketing site rebuild will need brand work sooner than expected. She wants to discuss in tomorrow's 1:1.",
      tasks: [
        { kind: "task", label: "Confirm pod A staffing — was the seventh req rolled into pod C?", due: "Before 1:1" },
        { kind: "task", label: "Decide on moving design hire forward by 6 weeks", due: "Tomorrow" },
      ],
      dates: [
        { kind: "date", label: "1:1 with Priya — Q3 hiring follow-up", due: "Tomorrow, 9:00 AM" },
      ],
    },
  },
};
