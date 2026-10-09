// =====================================================================================
//  ALL CLIENT-FACING WORDING FROM THE BOOKING DOC LIVES HERE, COPIED FROM THE DOC.
//  Only spelling / grammar fixes were made. Emphasis marks:
//     **bold** (gold)    !!warning!! (red)    //italic//    __underline__
//  Change a sentence here and nowhere else.
//
//  NOTE (deliberate difference from the doc): the doc says the down payment must be paid
//  within 24 hours. The nailtech asked for 72 hours counted from the moment of reserving.
//  Change it here AND in Admin > Settings ("Hours to pay the downpayment") if needed.
//
//  Bump POLICY_VERSION whenever the policies change: every client is then asked to agree again.
// =====================================================================================

export const POLICY_VERSION = '2026-10-v2'
export const policyAccepted = () => { try { return localStorage.getItem('cpn_policy_ok') === POLICY_VERSION } catch { return false } }
export const savePolicyAccepted = () => { try { localStorage.setItem('cpn_policy_ok', POLICY_VERSION) } catch { /* ignore */ } }

export const POLICY_INTRO =
  'Please do read the Policies when booking to avoid any added fees and surprises on the day of appointment'

// ---------- Policies (doc page "Policies", "Location", "Reminders") ----------
const resched_day = '!!Rescheduling on the day of the appointment is not allowed!!'
const resched_rule =
  'Rescheduling is only allowed within 24 hours of booking, with no fee; otherwise, __RESCHEDULING FEE__ IS **100php** to be paid IMMEDIATELY'
const resched_once = '**You will only be allowed to reschedule ONCE**'
const cancel_72 = '!!Cancellation 72 hours before the appointment will lead to forfeiture of the DP/Deposit!!'
const cancel_48 = '!!CANCELLATION WITHIN 48 HOURS OF APPOINTMENT OR ON THE DAY OF APPOINTMENT, CLIENT WILL HAVE TO PAY IN FULL!!'

export const POLICIES = [
  {
    title: 'Booking and Downpayment',
    teaser: 'NO DOWNPAYMENT = NO APPOINTMENT',
    items: [
      'Appointments can take 2-4 hours. Please plan accordingly to avoid rushing',
      'Please do mention if you have any existing nail enhancements; //failure to do so will lead to an additional 80php fee on top of removal fees//',
      'Please inform me ahead if you are bringing a companion, and **the companion must arrive with you** to avoid interruptions',
      'Minimum down payment of __400php__ is required to book your slot',
      '!!NO DOWNPAYMENT = NO APPOINTMENT.!! **Down payment must be paid strictly within 72 hours of booking**',
      '!!Down payment is NON-REFUNDABLE!!',
      'DP is to be paid through GCash',
      'Balance can be paid through GCash or Cash',
    ],
  },
  {
    title: 'Rescheduling and Cancellations',
    teaser: 'IF 10 MINS LATE = 100PHP FEE',
    items: [
      {
        text: '!!IF 10 MINS LATE = 100PHP FEE!!*',
        sub: ['This means you must be inside and seated before 10mins past your booked time slot //( fee is subject to 30php increase for __every minute__ past the grace period if the appointment can still go through)//'],
      },
      '!!IF 20 MINS LATE = CANCELLED APPOINTMENT!!',
      resched_day,
      resched_rule,
      resched_once,
      cancel_72,
      cancel_48,
      '!!NON-SETTLEMENT OF PAYMENTS WILL LEAD TO YOU BEING BLOCKED AND BANNED FROM RE-BOOKING!!',
      '!!No Show / No Updates will result in being banned from rebooking and will be blocked!!',
    ],
  },
  {
    title: 'Location',
    teaser: "Main landmark is McDonald's, Fuente Osmeña",
    items: [
      "Main landmark is //McDonald's, Fuente Osmeña//",
      'Exact address will be given after confirmation of the booking',
      'Parking is available around the area (Private Parking is currently unavailable)',
      'Workspace is NOT air-conditioned; best to dress lightly and comfortably',
      'There are also friendly dogs around (Labrador and Golden Retriever). Please do inform me if you are not comfortable with them being around 🤗',
    ],
  },
  {
    title: 'Reminders',
    teaser: '1-week warranty',
    items: [
      '**Please refrain from arriving too early or arriving late to your scheduled appointment.**',
      'Try not to touch your hair or retrieve things from your bag to avoid dust and lint from sticking to nails.',
      'This is a home-based business; there may be other people coming, going, and around during the appointment.',
      'If you feel any form of discomfort during the appointment, please feel free to inform me',
      '1-week warranty. If nail enhancements are damaged* within a week of the appointment, retouching or any fixing is free (pls message ahead)',
    ],
    footnote: '* Please avoid forcefully ripping off your nail enhancements to avoid damage to natural nails',
  },
]

// Shown on the client's booking page for rescheduling / cancelling (same wording as above)
export const CHANGE_LINES = [resched_day, resched_rule, resched_once, cancel_72, cancel_48]

// ---------- "Additional reminders after they paid" (doc page 6). Shown only after confirmation. ----------
// seatedBy = the booked time + 15 minutes (the doc's "N:15"), worked out per booking.
export const reminders = (seatedBy) => [
  '**Please be mindful of the time; refrain from arriving more than 10 mins early or arriving late to your scheduled appointment**',
  '**PLEASE SEND A MESSAGE UPON ARRIVAL**',
  '**ONLY ONE (1) COMPANION IS ALLOWED and MUST ARRIVE WITH YOU to avoid interruption. Please also message ahead if you will be bringing a companion**',
  '**Parking is available nearby (private parking not yet available)**',
  {
    text: '!!IF 15 MINS LATE = 100PHP FEE!!*',
    sub: [
      `//(Must be INSIDE AND SEATED BY ${seatedBy})//`,
      '{fee is subject to 30php increase every 5mins if appointment can still go through}',
    ],
  },
  '!!IF OVER 20 MINS LATE = CANCELLED APPOINTMENT!!',
  '!!CANCELLING ON THE DAY OF APPOINTMENT, CLIENT MUST PAY FULL PRICE OF SET!!',
  '!!Non-settlement of payments will have you blocked and banned from booking again!!',
  '!!Rescheduling on the day of appointment is not allowed!!',
  'Workspace is NOT air-conditioned, best to dress lightly and comfortably',
  'There are also friendly dogs around (Labrador and Golden Retriever) please do inform me if you are not comfortable with them being around 🤗',
  'This is a Home Based business there will be other people coming, going, and around during the appointment',
  'Please do read the Policies when booking to avoid any added fees and surprises on the day of appointment 😵‍💫',
]

// ---------- Services (doc page "Services") ----------
export const SERVICE_GROUPS = [
  {
    title: 'Structured Manicure types',
    intro:
      'These are types of manicures that add a layer to your __//natural nail only, with no added length or extension//__. This product adds strength, shape, and structure to help prevent chipping and breakage, rather than simply applying gel polish for color.',
    items: [
      {
        key: 'biab', name: 'BIAB (Builder In A Bottle)', price: '₱550',
        text: 'A more flexible and natural-feeling form of structured manicure. A soft builder gel that can be removed with acetone soak-off.',
        recHeader: 'Recommended for',
        rec: ['those only occasionally getting their nails done', 'those who want to maintain __short-medium nails only__', 'those with already thick and strong nail beds'],
      },
      {
        key: 'hardgel', name: 'Hard Gel Overlay', price: '₱590',
        text: 'A more rigid manicure that provides a more durable structure to the natural nails. Must only be removed professionally to avoid damage to natural nails.',
        recHeader: 'Recommended for',
        rec: ['those who are committed to growing their natural nails longer', 'those who want to grow their nails medium to long', 'those who plan to maintain their nails monthly', 'those with thinner, more fragile nail plates'],
      },
    ],
  },
  {
    title: 'Nail Extensions',
    intro: 'This service adds durable artificial length to the natural nail.',
    items: [
      {
        key: 'softgel', name: 'Soft Gel Extensions', price: '₱580 – ₱650',
        text: '__The most common form of extension__ using full-cover soft-gel tips that are applied over the natural nail to add different lengths and shapes; must be completely removed at every appointment. __Suitable for all__',
        rec: [],
      },
      {
        key: 'hardgele', name: 'Hard Gel Extensions', price: '₱650 – ₱750',
        text: 'A lesser-known type of extension that uses a file-off hard gel to add length and structure to the natural nail. Unlike soft gel extensions, Hard Gel extensions are manually built with gel forms rather than applying a pre-shaped full-cover tip.',
        recHeader: 'Similar to a hard gel manicure, it is recommended for',
        rec: ['those who are committed to growing their natural nails longer', 'those who want to grow their nails medium to long', 'those who plan to maintain their nails monthly', 'those with thinner, more fragile nail plates'],
      },
    ],
  },
  {
    title: 'Add-on service',
    intro: '',
    items: [
      {
        name: 'Intensive Manicure', price: '₱300',
        text: 'This is a more detailed Dry Manicure that makes sure to remove any dry and dead skin surrounding the nail plate, similar to a Russian Manicure. //Adding this to your nail service ensures a cleaner, more polished look.//',
        rec: [],
      },
    ],
  },
]

// ---------- Rates (doc page "Rates") ----------
export const RATES = {
  base: [
    { head: 'Structured Manicures', rows: [['BIAB', '550'], ['Hard Gel Mani', '590']] },
    { head: 'Soft Gel Extensions', rows: [['Short', '580'], ['Medium', '620'], ['Long', '650']] },
    { head: 'Hard Gel Extensions', rows: [['Short', '650'], ['Medium', '700'], ['Long', '750']] },
    { head: 'Add-on', rows: [['Intensive Manicure', '300']] },
  ],
  removals: [
    { head: 'My Work', rows: [['Structured Manicure Fill*', '80'], ['Soft Gel removal w/ new set', '100']] },
    { head: 'Foreign Removals', rows: [['Foreign Soft Gel removal w/new set', '200'], ['Foreign Hard gel removal w/new set', '300']] },
  ],
  notes: [
    '*Structured manicure Fills/ Fills in general are considered a removal',
    '__Structured mani fill only available for those that pick BIAB and Hard Gel mani__',
  ],
}

// ---------- Appointment form (doc "Flow of appointment form") ----------
export const TIER_NOTE = 'Prices will still vary within tiers depending on exact design; for the exact price, message me directly.'
export const AFTER_RESERVE = 'Please send photo of your design to @cappriccio.nails for full quotation.'
export const REMOVAL_NOTE =
  'Please do mention if you have any existing nail enhancements; //failure to do so will lead to an additional 80php fee on top of removal fees//'
export const F_HARD_NOTE = 'Foreign Hard Gel removal only available for 5pm slots'

// ---------- Forgotten booking code (client messages the nailtech; nothing is recovered automatically) ----------
export const FORGOT_FIELDS = ['Your full name', 'The phone number you booked with', 'Your Instagram handle', 'The exact date and time of your booking', 'Your service (and tier, if you remember)']
export const FORGOT_TEMPLATE = `Hi! I forgot my booking code.
Name: 
Phone number: 
Instagram: 
Booking date & time: 
Service: `
