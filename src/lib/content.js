// All the wording from the Booking doc lives here, so the nailtech's text can be edited in one place.

export const POLICIES = [
  {
    title: 'Booking & downpayment',
    items: [
      'Appointments take 2–4 hours. Please plan so you are not rushed.',
      'Tell me about any existing nail enhancements. Not mentioning them adds ₱80 on top of removal fees.',
      'Tell me ahead if you are bringing a companion. Only 1 is allowed, and they must arrive with you.',
      'Minimum downpayment is ₱400 (you may pay more). NO DOWNPAYMENT = NO APPOINTMENT.',
      'Pay via GCash, then upload your receipt screenshot on this site within 12 hours of booking, or your slot is released to others. You can also pay right away while filling out the form.',
      'The downpayment is NON-REFUNDABLE. Balance can be paid in GCash or cash.',
    ],
  },
  {
    title: 'Late, rescheduling & cancellations',
    items: [
      'Be inside and seated within 15 minutes of your slot. Late fee is ₱100, plus ₱30 for every 5 minutes after that, if the appointment can still go through.',
      'Over 20 minutes late = appointment cancelled.',
      'No rescheduling on the day of the appointment. To reschedule, message me on Instagram. Only ONCE; free within 24 hours of booking, otherwise ₱100 paid immediately.',
      'Cancelling within 72 hours of the appointment forfeits your downpayment. Cancelling within 48 hours or on the day means paying in full. Online cancellation is only available until 72 hours before your slot.',
      'Non-settlement of payments = blocked and banned from re-booking.',
      'No show / no update = blocked and banned from re-booking.',
    ],
  },
  {
    title: 'Good to know',
    items: [
      'Main landmark: McDonald’s, Fuente Osmeña. The exact address is sent after your booking is confirmed.',
      'Parking is available around the area (no private parking yet).',
      'The workspace is NOT air-conditioned. Dress lightly and comfortably.',
      'Friendly dogs are around (Labrador and Golden Retriever). Let me know if you are not comfortable with them.',
      'This is a home-based business, so other people may be around during your appointment.',
      'Please do not arrive too early or late. Try not to touch your hair or reach into your bag so dust and lint don’t stick to your nails.',
      '1-week warranty: if your enhancements get damaged within a week, retouching is free (message me first). Please do not rip them off.',
    ],
  },
]

// Shown only AFTER the nailtech confirms the downpayment
export const REMINDERS = [
  'Please do not arrive more than 10 minutes early, or late.',
  'PLEASE SEND A MESSAGE UPON ARRIVAL.',
  'Only ONE (1) companion is allowed, and they must arrive with you. Message ahead if you are bringing one.',
  'Parking is available nearby (private parking not yet available).',
  'Late fee: you must be INSIDE AND SEATED within 15 minutes of your slot = ₱100, plus ₱30 every 5 minutes after if the appointment can still go through.',
  'Over 20 minutes late = canceled appointment.',
  'Cancelling on the day of the appointment = full price of the set.',
  'The workspace is NOT air-conditioned, and friendly dogs are around.',
  'Home-based business: other people may be coming and going.',
]

export const SERVICE_INFO = [
  {
    group: 'Structured Manicure',
    blurb: 'Adds a layer to your natural nail only, with no added length. It adds strength, shape and structure to help prevent chipping and breakage.',
    items: [
      { name: 'BIAB (Builder In A Bottle)', rate: '₱550',
        text: 'A more flexible, natural-feeling structured manicure. Soft builder gel that removes with an acetone soak-off.',
        rec: ['Occasional nail appointments', 'Short to medium nails only', 'Already thick, strong nail beds'] },
      { name: 'Hard Gel Overlay', rate: '₱590',
        text: 'A more rigid manicure with more durable structure. Must only be removed professionally to avoid damage.',
        rec: ['Growing natural nails longer', 'Medium to long nails', 'Monthly maintenance', 'Thinner, more fragile nail plates'] },
    ],
  },
  {
    group: 'Nail Extensions',
    blurb: 'Adds durable artificial length to the natural nail.',
    items: [
      { name: 'Soft Gel Extensions', rate: 'Short ₱580 · Medium ₱620 · Long ₱650',
        text: 'Full-cover soft gel tips applied over the natural nail. Must be completely removed at every appointment. Suitable for all.', rec: [] },
      { name: 'Hard Gel Extensions', rate: 'Short ₱650 · Medium ₱700 · Long ₱750',
        text: 'File-off hard gel, manually built with gel forms rather than pre-shaped tips. Adds length and structure.',
        rec: ['Growing natural nails longer', 'Medium to long nails', 'Monthly maintenance', 'Thinner, more fragile nail plates'] },
    ],
  },
  {
    group: 'Add-on',
    blurb: '',
    items: [
      { name: 'Intensive Manicure', rate: '₱300',
        text: 'A more detailed dry manicure that removes dry and dead skin around the nail plate, similar to a Russian manicure, for a cleaner, more polished look.', rec: [] },
    ],
  },
]

export const REMOVAL_RATES = [
  ['Structured manicure fill*', '₱80'],
  ['Soft gel removal w/ new set (my work)', '₱100'],
  ['Foreign soft gel removal w/ new set', '₱200'],
  ['Foreign hard gel removal w/ new set', '₱300 (5 PM slots only)'],
]

export const TIER_NOTE =
  'Prices still vary within a tier depending on the exact design. For your exact price, message me on Instagram and send your inspo.'
