import {
  imgAdviceDebt,
  imgAdviceFinance,
  imgAdviceSavings,
  pictoBreastCancer,
  pictoBullesClavardage,
  pictoCarteCreditRed,
  pictoComptesRed,
  pictoEmpruntsRed,
  pictoEpargnePlacementsRed,
  pictoInsuranceTheft,
  pictoMainSacDollar,
  pictoMortgageRed,
  pictoOrdinateur,
  pictoPointInterrogation,
  pictoPromo,
  pictoSocialFacebook,
  pictoSocialInstagram,
  pictoSocialLinkedin,
  pictoSocialTiktok,
  pictoSocialTwitter,
  pictoSocialYoutube,
} from "./assets/nbcAssets";

export type MenuLink = { label: string; href: string; note?: string };
export type MenuGroup = { title: string; links: MenuLink[] };
export type Promo = { eyebrow: string; title: string; text: string; href: string; cta: string };

export type NavItem = {
  label: string;
  href: string;
  groups: MenuGroup[];
  promo?: Promo;
};

const P = "https://www.nbc.ca";

export const navItems: NavItem[] = [
  {
    label: "Bank accounts",
    href: `${P}/personal/accounts.html`,
    groups: [
      {
        title: "Accounts",
        links: [
          { label: "Chequing accounts", href: `${P}/personal/accounts/chequing.html` },
          { label: "Savings accounts", href: `${P}/personal/accounts/savings.html` },
          { label: "U.S. dollar accounts", href: `${P}/personal/accounts/us-dollar.html` },
          { label: "Student accounts", href: `${P}/personal/accounts/students.html` },
          { label: "Newcomer accounts", href: `${P}/personal/newcomers.html` },
        ],
      },
      {
        title: "Solutions",
        links: [
          { label: "All-In-One account", href: `${P}/personal/accounts/all-in-one.html` },
          { label: "Free chequing account", href: `${P}/personal/accounts/free-chequing.html` },
          { label: "Interest rates", href: `${P}/rates.html` },
          { label: "Switch to National Bank", href: `${P}/personal/switch-national-bank.html` },
          { label: "Find a branch", href: `${P}/contact-us.html` },
        ],
      },
    ],
    promo: {
      eyebrow: "Cash Advantage Solution",
      title: "A promotional rate of 3%",
      text: "For a limited time, earn more on your savings and give your projects a boost.",
      href: `${P}/personal/savings-investments/solutions/cash-solution.html`,
      cta: "Take advantage of our promo",
    },
  },
  {
    label: "Credit cards",
    href: `${P}/personal/mastercard-credit-cards.html`,
    groups: [
      {
        title: "Credit cards",
        links: [
          { label: "Allure Mastercard", href: `${P}/personal/mastercard-credit-cards/allure.html` },
          { label: "Cashback World Mastercard", href: `${P}/personal/mastercard-credit-cards/cashback-world.html` },
          { label: "Platinum Mastercard", href: `${P}/personal/mastercard-credit-cards/platinum.html` },
          { label: "World Elite Mastercard", href: `${P}/personal/mastercard-credit-cards/world-elite.html` },
          { label: "Student Mastercard", href: `${P}/personal/mastercard-credit-cards/student.html` },
        ],
      },
      {
        title: "Manage your card",
        links: [
          { label: "Compare all cards", href: `${P}/personal/mastercard-credit-cards.html` },
          { label: "Rewards and benefits", href: `${P}/personal/mastercard-credit-cards/rewards.html` },
          { label: "Credit card insurance", href: `${P}/personal/insurance.html` },
          { label: "Credit card interest rates", href: `${P}/rates.html` },
        ],
      },
    ],
    promo: {
      eyebrow: "Mastercard",
      title: "Make a difference",
      text: "With the Allure® Mastercard®, enjoy valuable banking benefits while supporting a good cause.",
      href: `${P}/personal/mastercard-credit-cards/allure.html`,
      cta: "Discover this card",
    },
  },
  {
    label: "Borrowing",
    href: `${P}/personal/borrowing.html`,
    groups: [
      {
        title: "Financing",
        links: [
          { label: "Personal loan", href: `${P}/personal/borrowing/personal-loan.html` },
          { label: "Personal Flex Line", href: `${P}/personal/borrowing/flex-line.html` },
          { label: "All-In-One line of credit", href: `${P}/personal/accounts/all-in-one.html` },
          { label: "RRSP line of credit", href: `${P}/personal/borrowing/rrsp-line-credit.html` },
          { label: "Student loan", href: `${P}/personal/borrowing/student-loan.html` },
        ],
      },
      {
        title: "Tools and rates",
        links: [
          { label: "Borrowing rates", href: `${P}/rates.html` },
          { label: "Loan calculators", href: `${P}/personal/tools/calculators.html` },
          { label: "Creditor insurance", href: `${P}/personal/insurance.html` },
          { label: "Manage your debts", href: `${P}/personal/advice.html#p2` },
        ],
      },
    ],
    promo: {
      eyebrow: "Entrepreneur offer",
      title: "You could save up to $1,313 a year",
      text: "Preferred terms on your personal banking services when you bank with us for business.",
      href: `${P}/personal/switch-national-bank/occupations/entrepreneurship.html`,
      cta: "See the offer",
    },
  },
  {
    label: "Mortgages",
    href: `${P}/personal/mortgages.html`,
    groups: [
      {
        title: "Mortgages",
        links: [
          { label: "Buying a home", href: `${P}/personal/mortgages/buy.html` },
          { label: "Mortgage renewal", href: `${P}/personal/mortgages/renew.html` },
          { label: "Refinancing", href: `${P}/personal/mortgages/refinance.html` },
          { label: "Mortgage pre-approval", href: `${P}/personal/mortgages/pre-approval.html` },
          { label: "Home equity line of credit", href: `${P}/personal/mortgages/home-equity.html` },
        ],
      },
      {
        title: "Plan your project",
        links: [
          { label: "Mortgage rates", href: `${P}/rates.html` },
          { label: "Mortgage calculator", href: `${P}/personal/tools/calculators.html` },
          { label: "First-time home buyers", href: `${P}/personal/mortgages/first-time-buyer.html` },
          { label: "Make an appointment", href: `${P}/contact-us.html` },
        ],
      },
    ],
    promo: {
      eyebrow: "Home financing",
      title: "Your home project starts here",
      text: "Get pre-approved and shop with confidence, with support from a mortgage specialist.",
      href: `${P}/personal/mortgages/pre-approval.html`,
      cta: "Get pre-approved",
    },
  },
  {
    label: "Savings and investments",
    href: `${P}/personal/savings-investments.html`,
    groups: [
      {
        title: "Save",
        links: [
          { label: "Savings accounts", href: `${P}/personal/savings-investments/savings-accounts.html` },
          { label: "Cash Advantage Solution", href: `${P}/personal/savings-investments/solutions/cash-solution.html` },
          { label: "GICs and term savings", href: `${P}/personal/savings-investments/gic.html` },
          { label: "TFSA", href: `${P}/personal/savings-investments/tfsa.html` },
          { label: "RRSP", href: `${P}/personal/savings-investments/rrsp.html` },
        ],
      },
      {
        title: "Invest",
        links: [
          { label: "Investment solutions", href: `${P}/personal/savings-investments/investments.html` },
          { label: "Direct Brokerage", href: `${P}/personal/savings-investments/direct-brokerage.html` },
          { label: "Financial advice", href: `${P}/wealth-management.html` },
          { label: "Rates and returns", href: `${P}/rates.html` },
        ],
      },
    ],
    promo: {
      eyebrow: "Limited-time offer",
      title: "Earn more on your savings",
      text: "Enjoy a promotional rate of 3% with the Cash Advantage Solution.",
      href: `${P}/personal/savings-investments/solutions/cash-solution.html`,
      cta: "Discover the solution",
    },
  },
  {
    label: "Insurance",
    href: `${P}/personal/insurance.html`,
    groups: [
      {
        title: "Insurance",
        links: [
          { label: "Home insurance", href: `${P}/personal/insurance/home.html` },
          { label: "Auto insurance", href: `${P}/personal/insurance/auto.html` },
          { label: "Life insurance", href: `${P}/personal/insurance/life.html` },
          { label: "Travel insurance", href: `${P}/personal/insurance/travel.html` },
          { label: "Creditor insurance", href: `${P}/personal/insurance.html` },
        ],
      },
      {
        title: "Protect yourself",
        links: [
          { label: "Fraud prevention", href: `${P}/personal/advice/security.html` },
          { label: "ABCs of security", href: `${P}/personal/advice/security.html` },
          { label: "Report fraud", href: `${P}/personal/advice/security.html` },
        ],
      },
    ],
    promo: {
      eyebrow: "Security",
      title: "Fraud prevention starts with awareness",
      text: "Learn how to spot potential threats and adopt simple habits that can help protect you.",
      href: `${P}/personal/advice/security.html`,
      cta: "Discover our tips",
    },
  },
  {
    label: "Advice",
    href: `${P}/personal/advice.html`,
    groups: [
      {
        title: "Advice",
        links: [
          { label: "Budget and finances", href: `${P}/personal/advice.html#p1` },
          { label: "Managing your debts", href: `${P}/personal/advice.html#p2` },
          { label: "Savings and investing", href: `${P}/personal/advice.html#p3` },
          { label: "Buying a home", href: `${P}/personal/mortgages.html` },
          { label: "Family", href: `${P}/personal/advice.html` },
        ],
      },
      {
        title: "Life milestones",
        links: [
          { label: "Newcomers to Canada", href: `${P}/personal/newcomers.html` },
          { label: "Students", href: `${P}/personal/students.html` },
          { label: "Retirement", href: `${P}/personal/retirement.html` },
          { label: "Fraud prevention", href: `${P}/personal/advice/security.html` },
        ],
      },
    ],
    promo: {
      eyebrow: "Advice",
      title: "Take control of your finances",
      text: "Big goals often start with small steps. Browse simple advice for every project.",
      href: `${P}/personal/advice.html`,
      cta: "Browse our advice",
    },
  },
  {
    label: "Offers",
    href: `${P}/personal/offers.html`,
    groups: [
      {
        title: "Offers",
        links: [
          { label: "All offers", href: `${P}/personal/offers.html` },
          { label: "3% promotional rate", href: `${P}/personal/savings-investments/solutions/cash-solution.html` },
          { label: "Student offers", href: `${P}/personal/students.html` },
          { label: "Newcomer offers", href: `${P}/personal/newcomers.html` },
          { label: "Refer a friend", href: `${P}/personal/offers/refer-a-friend.html` },
        ],
      },
      {
        title: "Build your project",
        links: [
          { label: "Switch your accounts", href: `${P}/personal/switch-national-bank.html` },
          { label: "Make an appointment", href: `${P}/contact-us.html` },
          { label: "Find a branch", href: `${P}/contact-us.html` },
        ],
      },
    ],
    promo: {
      eyebrow: "New clients",
      title: "Your project starts here",
      text: "Meet with an advisor and build the banking package that fits your life.",
      href: `${P}/personal/switch-national-bank.html`,
      cta: "Become a client",
    },
  },
];

export const headlineCards = [
  {
    icon: pictoMainSacDollar,
    promoBadge: pictoPromo,
    title: "Enjoy a promotional rate of 3%",
    text: "For a limited time, earn more on your savings and give your projects a boost with the Cash Advantage Solution.",
    cta: "Take advantage of our promo",
    href: "https://www.nbc.ca/personal/savings-investments/solutions/cash-solution.html",
  },
  {
    icon: pictoBreastCancer,
    promoBadge: null,
    title: "Make a difference",
    text: "With the Allure® Mastercard®, enjoy valuable banking benefits while supporting a good cause through your everyday spending.",
    cta: "Discover this card",
    href: "https://www.nbc.ca/personal/mastercard-credit-cards/allure.html",
  },
  {
    icon: pictoInsuranceTheft,
    promoBadge: null,
    title: "Fraud prevention starts with awareness",
    text: "Cybersecurity is everyone's responsibility. Learn how to spot potential threats and adopt simple habits that can help protect you from fraud.",
    cta: "Discover our tips",
    href: "https://www.nbc.ca/personal/advice/security.html",
  },
];

export const bankingServices = [
  { label: "Accounts", icon: pictoComptesRed, href: "https://www.nbc.ca/personal/accounts.html" },
  { label: "Credit cards", icon: pictoCarteCreditRed, href: "https://www.nbc.ca/personal/mastercard-credit-cards.html" },
  { label: "Mortgage", icon: pictoMortgageRed, href: "https://www.nbc.ca/personal/mortgages.html" },
  {
    label: "Savings and investments",
    icon: pictoEpargnePlacementsRed,
    href: "https://www.nbc.ca/personal/savings-investments.html",
  },
  { label: "Loans", icon: pictoEmpruntsRed, href: "https://www.nbc.ca/personal/borrowing.html" },
];

export const adviceCards = [
  {
    image: imgAdviceFinance,
    title: "Understanding your financial situation",
    text: "Strong finances start with taking a closer look. Take the time to review your income, expenses, and future plans so you can clearly understand where you stand.",
    cta: "Get started",
    href: "https://www.nbc.ca/personal/advice.html#p1",
  },
  {
    image: imgAdviceDebt,
    title: "Manage your debts",
    text: "Managing debt isn't always simple, especially during periods of uncertainty or unexpected life events. Learn how to calculate what you owe and prioritize your next steps so you can move forward with more confidence and peace of mind.",
    cta: "Browse our practical advice",
    href: "https://www.nbc.ca/personal/advice.html#p2",
  },
  {
    image: imgAdviceSavings,
    title: "Set your savings and investment goals",
    text: "Do you have ideas you want to bring to life? Start saving regularly. Invest what you're putting aside to help your money grow so you can turn your plans into reality!",
    cta: "Get our tips",
    href: "https://www.nbc.ca/personal/advice.html#p3",
  },
];

export const helpCards = [
  {
    icon: pictoOrdinateur,
    title: "Your online bank",
    text: "Carry out most of your daily transactions quickly & easily.",
    cta: "Sign in",
    href: "https://app.bnc.ca/",
    action: "link" as const,
  },
  {
    icon: pictoBullesClavardage,
    title: "Message Support",
    text: "The answers to your questions, all in one step, 24/7 — with a specialist on call.",
    cta: "Message Support",
    href: "#chat",
    action: "chat" as const,
  },
  {
    icon: pictoPointInterrogation,
    title: "Help centre",
    text: "All of our frequently asked questions in one place.",
    cta: "Visit our Help centre",
    href: "https://www.nbc.ca/help.html",
    action: "link" as const,
  },
];

export const socialLinks = [
  { label: "Facebook", icon: pictoSocialFacebook, href: "https://www.facebook.com/nationalbanknetworks" },
  { label: "Twitter", icon: pictoSocialTwitter, href: "https://twitter.com/nationalbank/" },
  { label: "YouTube", icon: pictoSocialYoutube, href: "https://www.youtube.com/c/nationalbankofcanada" },
  { label: "LinkedIn", icon: pictoSocialLinkedin, href: "https://www.linkedin.com/company/national-bank-of-canada/" },
  { label: "Instagram", icon: pictoSocialInstagram, href: "https://www.instagram.com/nationalbankofcanada/" },
  { label: "TikTok", icon: pictoSocialTiktok, href: "https://www.tiktok.com/@banquenationale" },
];

export const footerColumns = [
  {
    title: "Useful links",
    links: [
      { label: "Change of address", href: "https://www.nbc.ca/contact-us.html" },
      { label: "Complaint settlement", href: "https://www.nbc.ca/about-us/governance/complaint-settlement.html" },
      { label: "Exchange rates", href: "https://www.nbc.ca/rates/exchange-rates.html" },
      { label: "Interest rates", href: "https://www.nbc.ca/rates.html" },
      { label: "Help and contact", href: "https://www.nbc.ca/contact-us.html" },
      { label: "Contact us", href: "https://www.nbc.ca/contact-us.html" },
      { label: "Find a branch", href: "https://www.nbc.ca/contact-us.html" },
      { label: "Make an appointment", href: "https://www.nbc.ca/contact-us.html" },
      { label: "Help Centre", href: "https://www.nbc.ca/help.html" },
    ],
  },
  {
    title: "ABCs of security",
    links: [
      { label: "Privacy and security", href: "https://www.nbc.ca/personal/advice/security.html" },
      { label: "Fraud prevention", href: "https://www.nbc.ca/personal/advice/security.html" },
      { label: "Privacy policy", href: "https://www.nbc.ca/privacy.html" },
      { label: "Digital data policy", href: "https://www.nbc.ca/privacy.html" },
      { label: "Identity theft and fraud prevention", href: "https://www.nbc.ca/personal/advice/security.html" },
      { label: "Report wrongdoing", href: "https://www.nbc.ca/about-us/governance.html" },
      { label: "Lost or stolen card", href: "https://www.nbc.ca/contact-us.html" },
    ],
  },
  {
    title: "Subsidiaries",
    links: [
      { label: "National Bank Trust", href: "https://www.nbc.ca/trust.html" },
      { label: "National Bank Investments", href: "https://www.nbim.com/" },
      { label: "Natbank", href: "https://www.natbank.com/" },
      { label: "National Bank Financial", href: "https://www.nbfwm.ca/" },
      { label: "Divisions of National Bank Financial", href: "https://www.nbfwm.ca/" },
      { label: "National Bank Direct Brokerage", href: "https://www.nbdb.ca/" },
      { label: "Private Banking 1859", href: "https://www.nbc.ca/private-banking.html" },
      { label: "National Bank Independent Network", href: "https://www.nbc.ca/nbin.html" },
    ],
  },
  {
    title: "News",
    links: [
      { label: "Press releases", href: "https://www.nbc.ca/about-us/news.html" },
      { label: "Financial news", href: "https://www.nbc.ca/about-us/news.html" },
      { label: "Important notices – Personal", href: "https://www.nbc.ca/personal/notice.html" },
      { label: "Important notices – Business", href: "https://www.nbc.ca/business/notice.html" },
      { label: "Careers", href: "https://www.nbc.ca/careers.html" },
      { label: "Life at National Bank", href: "https://www.nbc.ca/careers.html" },
      { label: "All Jobs", href: "https://www.nbc.ca/careers.html" },
      { label: "Students and Internships", href: "https://www.nbc.ca/careers/students.html" },
    ],
  },
];

export const searchIndex = [
  { label: "Chequing accounts", category: "Accounts", href: "https://www.nbc.ca/personal/accounts/chequing.html" },
  { label: "Savings accounts", category: "Accounts", href: "https://www.nbc.ca/personal/accounts/savings.html" },
  { label: "All-In-One account", category: "Accounts", href: "https://www.nbc.ca/personal/accounts/all-in-one.html" },
  { label: "Cash Advantage Solution – 3%", category: "Promotions", href: "https://www.nbc.ca/personal/savings-investments/solutions/cash-solution.html" },
  { label: "Allure Mastercard", category: "Credit cards", href: "https://www.nbc.ca/personal/mastercard-credit-cards/allure.html" },
  { label: "Cashback World Mastercard", category: "Credit cards", href: "https://www.nbc.ca/personal/mastercard-credit-cards/cashback-world.html" },
  { label: "Mortgage pre-approval", category: "Mortgages", href: "https://www.nbc.ca/personal/mortgages/pre-approval.html" },
  { label: "Mortgage rates", category: "Mortgages", href: "https://www.nbc.ca/rates.html" },
  { label: "TFSA", category: "Savings and investments", href: "https://www.nbc.ca/personal/savings-investments/tfsa.html" },
  { label: "RRSP", category: "Savings and investments", href: "https://www.nbc.ca/personal/savings-investments/rrsp.html" },
  { label: "Personal loan", category: "Borrowing", href: "https://www.nbc.ca/personal/borrowing/personal-loan.html" },
  { label: "Personal Flex Line", category: "Borrowing", href: "https://www.nbc.ca/personal/borrowing/flex-line.html" },
  { label: "Interest rates", category: "Rates", href: "https://www.nbc.ca/rates.html" },
  { label: "Exchange rates", category: "Rates", href: "https://www.nbc.ca/rates/exchange-rates.html" },
  { label: "Report fraud", category: "Security", href: "https://www.nbc.ca/personal/advice/security.html" },
  { label: "Find a branch", category: "Help", href: "https://www.nbc.ca/contact-us.html" },
  { label: "Make an appointment", category: "Help", href: "https://www.nbc.ca/contact-us.html" },
  { label: "Help centre", category: "Help", href: "https://www.nbc.ca/help.html" },
  { label: "Newcomers to Canada", category: "Advice", href: "https://www.nbc.ca/personal/newcomers.html" },
  { label: "Student banking", category: "Advice", href: "https://www.nbc.ca/personal/students.html" },
];

export const legalLinks = [
  { label: "Terms of use", href: "https://www.nbc.ca/terms-of-use.html" },
  { label: "Accessibility plan", href: "https://www.nbc.ca/accessibility.html" },
  { label: "Accessibility Progress Report", href: "https://www.nbc.ca/accessibility.html" },
  { label: "Accessibility feedback process", href: "https://www.nbc.ca/accessibility.html" },
];

export const becomeClientOptions = [
  { label: "Personal", href: "https://www.nbc.ca/personal/switch-national-bank.html" },
  { label: "Business", href: "https://www.nbc.ca/business/accounts.html" },
];

export const signInOptions = [
  { label: "Personal", desc: "Online transactions", href: "https://app.bnc.ca/?lang=en", primary: true },
  { label: "Business", desc: "Commercial banking", href: "https://commercial.bnc.ca/app/business-banking/en-CA/redirections", primary: true },
  { label: "Direct Brokerage", desc: "", href: "https://client.bnc.ca/nbdb/login", primary: false },
  { label: "National Bank Financial", desc: "", href: "https://client.bnc.ca/nbfwm/login", primary: false },
  { label: "Natbank", desc: "", href: "https://natbank.onlinebank.com/SignIn.aspx", primary: false },
  { label: "Group Retirement Plans", desc: "", href: "https://nbtmyretirement.com/", primary: false },
  { label: "Private Banking 1859", desc: "", href: "https://client.bnc.ca/pb1859/login", primary: false },
];
