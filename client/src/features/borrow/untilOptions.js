// S4 "Until" choices: every half hour from about 15 minutes from now up to the longest loan
// time (GET /api/lookups → loanRules.maxLoanHours), labelled like the design: "14:00 (2 h 30 min)".
const MINUTE = 60 * 1000;
const STEP = 30 * MINUTE;
const MIN_LEAD = 15 * MINUTE;

export function hoursText(hours) {
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

// "45 min", "2 h", "2 h 30 min" (rounded to 5 minutes).
function durationText(ms) {
  const minutes = Math.round(ms / (5 * MINUTE)) * 5;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function timeText(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// [{ value: ISO time for dueAt, label }]
export function untilOptions(now, maxLoanHours) {
  const start = now.getTime();
  const limit = start + maxLoanHours * 60 * MINUTE;
  const options = [];
  for (let time = Math.ceil((start + MIN_LEAD) / STEP) * STEP; time <= limit; time += STEP) {
    const date = new Date(time);
    options.push({
      value: date.toISOString(),
      label: `${timeText(date)} (${durationText(time - start)})`,
    });
  }
  return options;
}
