import {
  contacts,
  dataProtection,
  grievanceOfficer,
  legalEntity,
  policyUpdated,
  site,
} from "@/lib/site-config";

/**
 * The six policy documents. Written against Indian law rather than generic
 * boilerplate: the DPDP Act 2023 and its 2025 Rules for privacy, the IT Rules
 * 2021 for grievance handling and takedowns, ASCI and the Consumer Protection
 * Act 2019 for affiliate disclosure, and the publicity-rights line drawn in
 * Titan Industries v Ramkumar Jewellers for celebrity imagery.
 *
 * This is a careful starting draft, not legal advice. Have a lawyer read it
 * before launch, and fill the PENDING details in site-config.ts.
 */

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "details"; rows: { label: string; value: string }[] }
  | { type: "note"; text: string };

export type LegalSection = { id: string; heading: string; blocks: LegalBlock[] };

export type LegalDoc = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lede: string;
  updated: string;
  sections: LegalSection[];
};

const grievanceRows = [
  { label: "Grievance Officer", value: grievanceOfficer.name },
  { label: "Email", value: grievanceOfficer.email },
  { label: "Acknowledged within", value: grievanceOfficer.acknowledgeWithin },
  { label: "Resolved within", value: grievanceOfficer.resolveWithin },
  { label: "Registered address", value: legalEntity.address },
];

export const legalDocs: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    description:
      "What CelebrityPersona collects, why, and the rights you have over it under India's Digital Personal Data Protection Act, 2023.",
    eyebrow: "Legal",
    h1: "Privacy policy",
    lede: "We collect very little, and we would rather tell you exactly what that is than hide it in nine pages of defined terms. This policy is written against India's Digital Personal Data Protection Act, 2023.",
    updated: policyUpdated,
    sections: [
      {
        id: "scope",
        heading: "1. What this covers",
        blocks: [
          {
            type: "p",
            text: `This policy covers ${site.domain} and any subdomain we run. It explains what personal data we handle when you read the site, save a look, or sign up for updates. In the language of the DPDP Act, we are the Data Fiduciary and you are the Data Principal.`,
          },
          {
            type: "p",
            text: "You can read every page on this site without giving us anything. Nothing below is required to browse.",
          },
        ],
      },
      {
        id: "what-we-collect",
        heading: "2. What we collect",
        blocks: [
          { type: "p", text: "Three categories, and no more than these." },
          {
            type: "list",
            items: [
              "If you sign up for updates: the WhatsApp number or email address you give us, and the date you gave it.",
              "If you save a look: the saved list itself, which is stored in your own browser and is not sent to us.",
              "Automatically, on every visit: your IP address, browser and device type, the pages you opened and the page that referred you. This is ordinary web server and analytics data.",
            ],
          },
          {
            type: "note",
            text: "We do not ask for your name, address, age, gender, payment details or government ID. If a form on this site ever asks for one of those, treat it as suspicious and tell us.",
          },
        ],
      },
      {
        id: "why",
        heading: "3. Why we collect it",
        blocks: [
          {
            type: "list",
            items: [
              "To send the updates you asked for, and nothing else, until you ask us to stop.",
              "To understand which looks and pages people actually use, so we decode more of what is wanted.",
              "To keep the site up, spot abuse, and diagnose faults.",
              "To meet our own legal obligations when we are required to keep a record.",
            ],
          },
          {
            type: "p",
            text: "We do not sell personal data. We do not build advertising profiles. We do not share your contact details with brands or retailers.",
          },
        ],
      },
      {
        id: "consent",
        heading: "4. Consent, and taking it back",
        blocks: [
          {
            type: "p",
            text: "Where we rely on your consent, that consent has to be free, specific, informed, unconditional and unambiguous, and it is given by a clear affirmative action. Ticking nothing and doing nothing is not consent.",
          },
          {
            type: "p",
            text: `You can withdraw consent at any time and it takes effect from then on. Reply STOP to any WhatsApp message, use the unsubscribe link in any email, or write to ${dataProtection.contact}. Withdrawing is as easy as giving it was.`,
          },
        ],
      },
      {
        id: "rights",
        heading: "5. Your rights",
        blocks: [
          {
            type: "p",
            text: "Under the DPDP Act you have five rights, and we will honour all five whether or not the Act is in force on the day you ask.",
          },
          {
            type: "list",
            items: [
              "Access: a summary of the personal data we hold about you and what we have done with it.",
              "Correction: have inaccurate or incomplete data fixed, completed or updated.",
              "Erasure: have your data deleted, unless a law requires us to keep it.",
              "Grievance redressal: a route to complain to us and get an answer.",
              "Nomination: nominate someone to exercise these rights for you if you die or become incapacitated.",
            ],
          },
          {
            type: "p",
            text: `Write to ${dataProtection.contact} to use any of them. We will respond within ${dataProtection.resolveWithin}, and usually much sooner.`,
          },
        ],
      },
      {
        id: "sharing",
        heading: "6. Who else sees it",
        blocks: [
          {
            type: "p",
            text: "Only the services that make the site work, and only the minimum each one needs.",
          },
          {
            type: "list",
            items: [
              "Our hosting and content delivery provider, which processes server logs.",
              "Our analytics provider, which processes page views in aggregate.",
              "Our email and WhatsApp sending provider, if you subscribed.",
              "Affiliate networks, when you click through to a retailer. They set their own attribution cookie and their own privacy policy applies from that point.",
            ],
          },
          {
            type: "p",
            text: "Some of these providers process data outside India. Where that happens, it is under contract terms that hold them to this policy.",
          },
        ],
      },
      {
        id: "children",
        heading: "7. Children",
        blocks: [
          {
            type: "p",
            text: "The DPDP Act treats anyone under 18 as a child and requires verifiable parental consent before their data is processed. This site is written for adults doing their own shopping and we do not knowingly collect data from anyone under 18.",
          },
          {
            type: "p",
            text: `If you believe a child's data has reached us, write to ${dataProtection.contact} and we will delete it.`,
          },
        ],
      },
      {
        id: "retention",
        heading: "8. How long we keep it",
        blocks: [
          {
            type: "list",
            items: [
              "Subscription details: until you unsubscribe, then deleted within 30 days.",
              "Server logs: 90 days, then deleted.",
              "Analytics: retained in aggregate, which is not tied back to you.",
              "Saved looks: they live in your browser, so clearing your browser data removes them and we never had a copy.",
            ],
          },
        ],
      },
      {
        id: "complaints",
        heading: "9. Complaints",
        blocks: [
          {
            type: "p",
            text: "Come to us first. If you are not satisfied with how we handled it, you can complain to the Data Protection Board of India, which is the statutory route under the DPDP Act.",
          },
          { type: "details", rows: grievanceRows },
        ],
      },
    ],
  },

  {
    slug: "terms",
    title: "Terms of Use",
    description:
      "The terms you accept by using CelebrityPersona: what the site is, what the prices mean, and what we are and are not responsible for.",
    eyebrow: "Legal",
    h1: "Terms of use",
    lede: "Short version: this is a magazine that happens to link to shops. Read the prices as journalism, not as an offer to sell you anything.",
    updated: policyUpdated,
    sections: [
      {
        id: "who",
        heading: "1. Who you are dealing with",
        blocks: [
          {
            type: "p",
            text: `${site.name} is published from India. By using the site you accept these terms. If you do not accept them, please do not use the site.`,
          },
          {
            type: "details",
            rows: [
              { label: "Published by", value: legalEntity.name },
              { label: "Registered address", value: legalEntity.address },
              { label: "Registration", value: legalEntity.cin },
              { label: "Contact", value: contacts.general },
            ],
          },
        ],
      },
      {
        id: "what-this-is",
        heading: "2. What this site is",
        blocks: [
          {
            type: "p",
            text: "We identify what public figures wore at public events, price the pieces, and point at alternatives you can buy. We are an editorial publication. We are not a shop, a marketplace, or a reseller, and we hold no stock.",
          },
          {
            type: "p",
            text: "Every purchase you make happens on someone else's website, under their terms, their pricing, their delivery promise and their returns policy. Your contract is with them and not with us.",
          },
        ],
      },
      {
        id: "prices",
        heading: "3. What the prices mean",
        blocks: [
          {
            type: "p",
            text: "A price on this site is a record of what we saw at a retailer on the date we last checked, and every outfit page shows that date. It is not an offer, a quotation, or a promise that the price still holds.",
          },
          {
            type: "list",
            items: [
              "Retailers change prices without notice, and often.",
              "Stock sells out, sometimes within hours of us publishing.",
              "Original prices for designer pieces are our best assessment from public sources, and where we cannot confirm one we say so rather than guess.",
              "Always check the price on the retailer's own page before you buy.",
            ],
          },
        ],
      },
      {
        id: "swaps",
        heading: "4. Swaps are swaps",
        blocks: [
          {
            type: "p",
            text: "A swap is a different product from a different brand that we judge to be close on cut, fabric and silhouette. It is never the same item, it is never a counterfeit, and we never present it as either.",
          },
          {
            type: "p",
            text: "Naming a swap alongside a celebrity is reporting, not endorsement. No celebrity, brand or agency featured on this site has approved, sponsored or been consulted on any swap we suggest.",
          },
        ],
      },
      {
        id: "affiliate",
        heading: "5. Commission",
        blocks: [
          {
            type: "p",
            text: "Some outbound links earn us a commission if you buy. This never changes what you pay and never decides which swap we choose. The affiliate disclosure page sets out exactly how this works.",
          },
        ],
      },
      {
        id: "your-use",
        heading: "6. How you may use the site",
        blocks: [
          {
            type: "p",
            text: "Read it, share it, quote it with a link back. What you may not do:",
          },
          {
            type: "list",
            items: [
              "Scrape or bulk-copy our decodes, price data or images for republication.",
              "Present our work as your own, or strip our credits from it.",
              "Interfere with the site, probe it for vulnerabilities, or try to break it.",
              "Use the site to do anything unlawful under Indian law.",
            ],
          },
        ],
      },
      {
        id: "our-content",
        heading: "7. Our content",
        blocks: [
          {
            type: "p",
            text: "The decodes, the writing, the price research, the design and the code are ours and are protected by copyright. Photographs are a separate matter and are covered on the photo credits page.",
          },
        ],
      },
      {
        id: "liability",
        heading: "8. What we are responsible for",
        blocks: [
          {
            type: "p",
            text: "We take real care over accuracy, and we correct mistakes openly. But we cannot promise the site is free of error, that a price is still live, or that a retailer will deliver what it promised.",
          },
          {
            type: "p",
            text: "To the extent Indian law allows, we are not liable for losses arising from a retailer's pricing, stock, delivery, quality or conduct, or from a price on this site having moved since we checked it. Nothing here limits liability that cannot lawfully be limited.",
          },
        ],
      },
      {
        id: "law",
        heading: "9. Governing law and grievances",
        blocks: [
          {
            type: "p",
            text: "These terms are governed by the laws of India, and the courts of India have jurisdiction.",
          },
          {
            type: "p",
            text: "Under the Information Technology Rules, 2021 a Grievance Officer handles complaints about content on this site. Anything sent to the address below gets an acknowledgement and a resolution inside the timelines shown.",
          },
          { type: "details", rows: grievanceRows },
        ],
      },
    ],
  },

  {
    slug: "affiliate-disclosure",
    title: "Affiliate Disclosure",
    description:
      "How CelebrityPersona earns commission, why it never changes which swap we pick, and how we label paid links under ASCI guidelines.",
    eyebrow: "Legal",
    h1: "Affiliate disclosure",
    lede: "We earn a commission on some of the links on this site. Here is precisely how that works, what it costs you, and what it does not buy.",
    updated: policyUpdated,
    sections: [
      {
        id: "short",
        heading: "1. The short version",
        blocks: [
          {
            type: "list",
            items: [
              "Some links to retailers are affiliate links.",
              "If you buy through one, the retailer pays us a small percentage.",
              "You pay exactly the same price either way.",
              "No brand pays us to be chosen as a swap, and none can.",
            ],
          },
        ],
      },
      {
        id: "how",
        heading: "2. How an affiliate link works",
        blocks: [
          {
            type: "p",
            text: "When you click through to a retailer, an affiliate network records that you arrived from us, usually by setting a cookie in your browser. If you buy within that network's attribution window, the retailer pays us a percentage of the sale out of its own margin.",
          },
          {
            type: "p",
            text: "The retailer's price is the retailer's price. The commission is deducted from what they keep, not added to what you pay.",
          },
        ],
      },
      {
        id: "independence",
        heading: "3. What commission does not buy",
        blocks: [
          {
            type: "p",
            text: "This is the part that matters, so we will be blunt about it.",
          },
          {
            type: "list",
            items: [
              "A swap is chosen because it is the closest match we can find on cut, fabric and silhouette. Commission rate is not a factor in that decision.",
              "We link to retailers we have no affiliate relationship with whenever they have the better match, and that happens often.",
              "No brand can pay to appear on this site, to be named as a swap, or to be removed from a comparison.",
              "If a piece is bad, we say so, whether or not we earn on it.",
            ],
          },
        ],
      },
      {
        id: "labelling",
        heading: "4. How we label it",
        blocks: [
          {
            type: "p",
            text: "Every page carrying affiliate links says so in the footer, and outbound commercial links are marked. The Advertising Standards Council of India treats affiliate commission as a material connection that has to be disclosed, and we agree with that.",
          },
          {
            type: "p",
            text: "We use plain words. If something is an ad, it says ad. We do not bury the disclosure at the end of a hashtag stack.",
          },
        ],
      },
      {
        id: "social",
        heading: "5. On Instagram and YouTube",
        blocks: [
          {
            type: "p",
            text: "The same rules apply to our video decodes, following the ASCI influencer guidelines:",
          },
          {
            type: "list",
            items: [
              "A spoken disclosure inside the first ten seconds, not only a caption.",
              "A visible on-screen label, in a size you can actually read.",
              "For videos over two minutes, the label stays up for the whole video rather than flashing once.",
              "Gifted product, paid partnership and affiliate commission are all disclosed, even where a brand never asked us to post.",
            ],
          },
        ],
      },
      {
        id: "why",
        heading: "6. Why we are strict about this",
        blocks: [
          {
            type: "p",
            text: "Partly because the Central Consumer Protection Authority can fine an entity up to fifty lakh rupees for a misleading advertisement, and brands and publishers are jointly liable. Mostly because a site whose entire pitch is honest pricing cannot be coy about how it makes money.",
          },
        ],
      },
      {
        id: "ask",
        heading: "7. Ask us",
        blocks: [
          {
            type: "p",
            text: `If you want to know whether a specific link earns us anything, ask and we will tell you. Write to ${contacts.partnerships}.`,
          },
        ],
      },
    ],
  },

  {
    slug: "cookies",
    title: "Cookie Policy",
    description:
      "The cookies and browser storage CelebrityPersona uses, what each one is for, and how to turn them off.",
    eyebrow: "Legal",
    h1: "Cookies",
    lede: "We use very few. None of them are advertising trackers, and the ones that matter most are set by the shops you click through to, not by us.",
    updated: policyUpdated,
    sections: [
      {
        id: "ours",
        heading: "1. What we set",
        blocks: [
          {
            type: "list",
            items: [
              "Essential: keeps the site working, remembers your consent choice, and helps us block abuse. These cannot be turned off without breaking the site.",
              "Analytics: counts page views so we know which decodes are worth doing more of. Aggregated, and not used to identify you.",
            ],
          },
        ],
      },
      {
        id: "storage",
        heading: "2. Browser storage, not cookies",
        blocks: [
          {
            type: "p",
            text: "Saved looks are kept in your browser's local storage rather than sent to us. That means the list lives on the device you saved it on, we never receive a copy, and clearing your browser data erases it.",
          },
        ],
      },
      {
        id: "affiliate",
        heading: "3. Affiliate cookies",
        blocks: [
          {
            type: "p",
            text: "When you click through to a retailer, the affiliate network sets a cookie so the retailer knows the visit came from us. That cookie belongs to them, sits under their privacy policy, and typically expires after a fixed attribution window.",
          },
          {
            type: "p",
            text: "Blocking third-party cookies stops this. It does not change your price and it does not stop you shopping. It only means we do not get paid for that visit.",
          },
        ],
      },
      {
        id: "control",
        heading: "4. Turning them off",
        blocks: [
          {
            type: "list",
            items: [
              "Every major browser lets you block or delete cookies in its privacy settings.",
              "Blocking analytics cookies is fine. The site works normally without them.",
              "Blocking essential cookies may break saving, consent and some navigation.",
            ],
          },
        ],
      },
      {
        id: "changes",
        heading: "5. Changes",
        blocks: [
          {
            type: "p",
            text: `If we add a cookie, this page changes first and the date at the top moves. Questions go to ${contacts.privacy}.`,
          },
        ],
      },
    ],
  },

  {
    slug: "dmca",
    title: "Copyright and Takedown",
    description:
      "How to report copyright infringement on CelebrityPersona, what your notice must contain, and the timelines we work to under the IT Rules, 2021.",
    eyebrow: "Legal",
    h1: "Copyright and takedown",
    lede: "If we have used something of yours without the right to, tell us and we will deal with it quickly. This is the route, and the timelines we hold ourselves to.",
    updated: policyUpdated,
    sections: [
      {
        id: "position",
        heading: "1. Our position",
        blocks: [
          {
            type: "p",
            text: "We publish from India, so the Copyright Act, 1957 and the Information Technology Rules, 2021 govern this, rather than the American DMCA that the page name borrows from. The practical effect is the same: a valid complaint gets acted on fast.",
          },
          {
            type: "p",
            text: "We would rather license properly than argue. If you own an image we are using and we have got the licence wrong, say so and we will either license it, credit it correctly, or take it down.",
          },
        ],
      },
      {
        id: "photographs",
        heading: "2. Photographs in particular",
        blocks: [
          {
            type: "p",
            text: "Event and paparazzi photography is the most common issue on a site like this. Every photograph we publish is either licensed from the agency, used with the photographer's permission, or credited under the terms we were given. Our photo credits page explains the sourcing.",
          },
        ],
      },
      {
        id: "filing",
        heading: "3. Sending a notice",
        blocks: [
          {
            type: "p",
            text: `Email ${contacts.copyright} with the subject line "Copyright notice". Include all of the following, because a notice missing these takes longer to act on:`,
          },
          {
            type: "list",
            items: [
              "The exact URL or URLs on this site where the work appears.",
              "A clear description of the work, and where the original can be seen.",
              "Proof that you own the rights, or authority to act for the owner.",
              "Your name, postal address, email and phone number.",
              "A statement that you believe in good faith that the use is not authorised.",
              "A statement that the information in your notice is accurate.",
            ],
          },
        ],
      },
      {
        id: "timeline",
        heading: "4. What happens next",
        blocks: [
          {
            type: "list",
            items: [
              `We acknowledge your notice within ${grievanceOfficer.acknowledgeWithin}.`,
              "We review it, and where it is clearly valid we take the material down while we review rather than after.",
              `We resolve and write back within ${grievanceOfficer.resolveWithin}.`,
              "If we decline, we tell you why in writing rather than going silent.",
            ],
          },
        ],
      },
      {
        id: "counter",
        heading: "5. If we took something down wrongly",
        blocks: [
          {
            type: "p",
            text: "If your material was removed and you hold the rights or a valid licence, reply to the same address with your evidence. We restore quickly when we got it wrong, and we say publicly that we did on the corrections page where the error was visible.",
          },
        ],
      },
      {
        id: "repeat",
        heading: "6. Repeat infringement",
        blocks: [
          {
            type: "p",
            text: "If a contributor supplies infringing material more than once, we stop working with them. There is no third strike.",
          },
        ],
      },
      {
        id: "contact",
        heading: "7. Where to send it",
        blocks: [{ type: "details", rows: grievanceRows }],
      },
    ],
  },

  {
    slug: "photo-credits",
    title: "Photo Credits",
    description:
      "Where CelebrityPersona's photographs come from, how we credit them, and the line we draw between reporting a celebrity's outfit and implying an endorsement.",
    eyebrow: "Legal",
    h1: "Photo credits",
    lede: "Photographs are the one thing on this site we do not make ourselves. So here is where they come from, who owns them, and the line we will not cross with them.",
    updated: policyUpdated,
    sections: [
      {
        id: "source",
        heading: "1. Where the photographs come from",
        blocks: [
          {
            type: "p",
            text: "Event and street photography is licensed from the agencies and photographers who shot it. Nothing is lifted from a celebrity's own social account and presented as ours, and nothing is pulled from a search engine and hoped for the best.",
          },
          {
            type: "p",
            text: "Product photography on swap listings belongs to the retailer selling the item, and is shown to identify the product we are pointing you at.",
          },
        ],
      },
      {
        id: "credit",
        heading: "2. How we credit",
        blocks: [
          {
            type: "list",
            items: [
              "Every editorial photograph carries a visible credit on the image itself.",
              "The credit names the photographer or agency as our licence requires.",
              "Where a licence requires specific wording, we use their wording rather than ours.",
              "If a credit is wrong, that is a correction like any other and gets logged as one.",
            ],
          },
        ],
      },
      {
        id: "personality",
        heading: "3. Reporting, not endorsement",
        blocks: [
          {
            type: "p",
            text: "Indian courts protect a celebrity's right to control the commercial use of their identity. In Titan Industries v Ramkumar Jewellers the Delhi High Court called this the right to control commercial use of human identity, and treated a jeweller's continued use of a star couple after the endorsement had lapsed as an infringement of it.",
          },
          {
            type: "p",
            text: "The same courts have been clear that using a celebrity's name or image for news, commentary and criticism is protected speech. That is the side of the line this site sits on. We report what a person wore in public and what it cost. We do not suggest they endorse us, the retailers we link to, or any swap we name.",
          },
        ],
      },
      {
        id: "never",
        heading: "4. What we will not do",
        blocks: [
          {
            type: "list",
            items: [
              "Use a celebrity's face in an advertisement, a banner, or any paid promotion.",
              "Edit a photograph so it misrepresents what someone wore or how they looked.",
              "Imply that a person, brand or agency has approved a swap or partnered with us.",
              "Publish an image taken somewhere a person had a reasonable expectation of privacy.",
            ],
          },
        ],
      },
      {
        id: "removal",
        heading: "5. Asking us to remove a photograph",
        blocks: [
          {
            type: "p",
            text: `If you are the photographer, the agency, the subject, or acting for them, write to ${contacts.copyright}. Tell us the page and what the problem is. The copyright and takedown page sets out the full process and the timelines.`,
          },
          {
            type: "p",
            text: "Requests from the person in the photograph are taken as seriously as requests from the rights holder, even when the licence is sound.",
          },
        ],
      },
      {
        id: "agencies",
        heading: "6. Agencies we license from",
        blocks: [
          {
            type: "note",
            text: "List the agencies and photographers you hold licences with here before launch, so readers can see the sourcing at a glance.",
          },
        ],
      },
    ],
  },
];

export const getLegalDoc = (slug: string) =>
  legalDocs.find((doc) => doc.slug === slug);
