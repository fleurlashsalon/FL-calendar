import { addDays, addMonths, format } from "date-fns";

export const SHIFT_MAX_DAYS = 30;

export const calcDateByRule = (
  baseDate: Date,
  rule: { kind: "weeks" | "months"; value: number },
) => {
  if (rule.kind === "weeks") return addDays(baseDate, rule.value * 7);
  return addMonths(baseDate, rule.value);
};

export const findNextAvailableDate = (
  target: Date,
  fullVacationSet: Set<string>,
  maxShiftDays = SHIFT_MAX_DAYS,
) => {
  let cursor = target;
  let attempts = 0;
  while (attempts < maxShiftDays && fullVacationSet.has(format(cursor, "yyyy-MM-dd"))) {
    cursor = addDays(cursor, 1);
    attempts += 1;
  }
  return cursor;
};

const nthMonday = (year: number, monthIndex: number, nth: number) => {
  const first = new Date(year, monthIndex, 1);
  const firstMondayOffset = (8 - first.getDay()) % 7;
  return 1 + firstMondayOffset + (nth - 1) * 7;
};

const vernalEquinoxDay = (year: number) =>
  Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));

const autumnEquinoxDay = (year: number) =>
  Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));

export const getJapanHolidaySet = (year: number) => {
  const holidays = new Set<string>();
  const add = (month: number, day: number) =>
    holidays.add(format(new Date(year, month - 1, day), "yyyy-MM-dd"));

  add(1, 1);
  add(1, nthMonday(year, 0, 2));
  add(2, 11);
  add(2, 23);
  add(3, vernalEquinoxDay(year));
  add(4, 29);
  add(5, 3);
  add(5, 4);
  add(5, 5);
  add(7, nthMonday(year, 6, 3));
  add(8, 11);
  add(9, nthMonday(year, 8, 3));
  add(9, autumnEquinoxDay(year));
  add(10, nthMonday(year, 9, 2));
  add(11, 3);
  add(11, 23);

  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(year, month - 1, day);
      if (date.getMonth() !== month - 1) break;
      const key = format(date, "yyyy-MM-dd");
      if (holidays.has(key) && date.getDay() === 0) {
        let substitute = addDays(date, 1);
        while (holidays.has(format(substitute, "yyyy-MM-dd"))) {
          substitute = addDays(substitute, 1);
        }
        holidays.add(format(substitute, "yyyy-MM-dd"));
      }
    }
  }

  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(year, month - 1, day);
      if (date.getMonth() !== month - 1) break;
      if (date.getDay() !== 1) continue;
      const prev = format(addDays(date, -1), "yyyy-MM-dd");
      const current = format(date, "yyyy-MM-dd");
      const next = format(addDays(date, 1), "yyyy-MM-dd");
      if (!holidays.has(current) && holidays.has(prev) && holidays.has(next)) {
        holidays.add(current);
      }
    }
  }

  return holidays;
};

