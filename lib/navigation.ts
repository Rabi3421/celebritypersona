/** Site navigation. Routing rather than content, so it stays in code. */
import { social } from "@/lib/site-config";

export const navLinks = [
  { label: "Outfits", href: "/outfits" },
  { label: "Celebrities", href: "/celebrities" },
  { label: "Occasions", href: "/occasions" },
  { label: "Budget", href: "/budget" },
  { label: "Trending", href: "/trending" },
];

export const footerColumns: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Browse",
    links: [
      { label: "All outfits", href: "/outfits" },
      { label: "Celebrities", href: "/celebrities" },
      { label: "Occasions", href: "/occasions" },
      { label: "By budget", href: "/budget" },
      { label: "Trending", href: "/trending" },
      { label: "Wedding edit", href: "#" },
    ],
  },
  {
    heading: "About",
    links: [
      { label: "Who we are", href: "/about" },
      { label: "How we work", href: "/how-we-work" },
      { label: "Corrections", href: "/corrections" },
      { label: "Contact", href: "/contact" },
      { label: "Report a price", href: "/report-a-price" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Affiliate disclosure", href: "/affiliate-disclosure" },
      { label: "Cookies", href: "/cookies" },
      { label: "DMCA", href: "/dmca" },
      { label: "Photo credits", href: "/photo-credits" },
    ],
  },
  {
    heading: "Follow",
    links: [
      { label: "Instagram", href: social.instagram },
      { label: "YouTube", href: social.youtube },
      { label: "Pinterest", href: social.pinterest },
      { label: "WhatsApp updates", href: "#" },
    ],
  },
];
