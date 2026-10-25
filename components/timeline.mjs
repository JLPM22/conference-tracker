// The timeline has twelve equally sized calendar-month columns. Use wall-clock
// calendar fields in the displayed zone so month boundaries match those columns.
export function calendarParts(value, zone = 'source') {
  if (typeof value === 'string' && (zone === 'source' || value.length === 10)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const [hour, minute, second] = value.length === 10 ? [12, 0, 0] : value.slice(11, 19).split(':').map(Number);
    return { year, month: month - 1, day, hour, minute, second };
  }
  const date = new Date(value);
  const prefix = zone === 'local' ? 'get' : 'getUTC';
  return {
    year: date[`${prefix}FullYear`](), month: date[`${prefix}Month`](),
    day: date[`${prefix}Date`](), hour: date[`${prefix}Hours`](),
    minute: date[`${prefix}Minutes`](), second: date[`${prefix}Seconds`](),
  };
}

export function monthPosition(value, firstMonth, zone = 'source') {
  const date = calendarParts(value, zone);
  const start = calendarParts(firstMonth, 'source');
  const wholeMonths = (date.year - start.year) * 12 + date.month - start.month;
  const daysInMonth = new Date(Date.UTC(date.year, date.month + 1, 0)).getUTCDate();
  const fractionOfDay = (date.hour * 3600 + date.minute * 60 + date.second) / 86_400;
  return (wholeMonths + (date.day - 1 + fractionOfDay) / daysInMonth) / 12 * 100;
}
