export function parseDateTime(input: string, baseDate: Date = new Date()): Date | null {
  const cleanInput = input.trim();

  // 1. Duration (e.g. 10s, 5m, 2h, 3d)
  const durationMatch = cleanInput.match(/^(\d+)([smhd])$/i);
  if (durationMatch) {
    const value = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();
    const date = new Date(baseDate);
    switch (unit) {
      case "s":
        date.setSeconds(date.getSeconds() + value);
        break;
      case "m":
        date.setMinutes(date.getMinutes() + value);
        break;
      case "h":
        date.setHours(date.getHours() + value);
        break;
      case "d":
        date.setDate(date.getDate() + value);
        break;
    }
    return date;
  }

  // 2. HH:MM format (e.g. 15:30)
  const timeMatch = cleanInput.match(/^([0-1]?\d|2[0-3]):([0-5]\d)$/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    // If it has already passed today, set to tomorrow
    if (date.getTime() <= baseDate.getTime()) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  // 3. Try parsing "YYYY-MM-DD HH:MM"
  const dateTimeMatch = cleanInput.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (dateTimeMatch) {
    const year = parseInt(dateTimeMatch[1], 10);
    const month = parseInt(dateTimeMatch[2], 10) - 1; // 0-indexed month
    const day = parseInt(dateTimeMatch[3], 10);
    const hours = parseInt(dateTimeMatch[4], 10);
    const minutes = parseInt(dateTimeMatch[5], 10);
    return new Date(year, month, day, hours, minutes, 0, 0);
  }

  // 4. Try parsing as a standard ISO string or Date string
  const timestamp = Date.parse(cleanInput);
  if (!isNaN(timestamp)) {
    return new Date(timestamp);
  }

  return null;
}
