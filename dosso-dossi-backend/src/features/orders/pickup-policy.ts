import { AppError } from '../../lib/errors.js';
import { addBusinessDays, businessDateTime, businessNow, businessParts } from '../../lib/business-time.js';

interface PickupBranch { isOpen: boolean; hours: string; prepMinutes: number }
const MINUTE = 60_000;

/** The badge and checkout share the same opening/preparation-time policy. */
export function isAcceptingOrders(branch: PickupBranch, now = businessNow()): boolean {
  try {
    validatePickupSlot(branch, 'asap', now);
    return true;
  } catch (error) {
    if (error instanceof AppError && error.code === 'BRANCH_CLOSED') return false;
    throw error;
  }
}

function minuteOfDay(value: string, allowMidnightEnd = false): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]), minutes = Number(match[2]);
  if (allowMidnightEnd && hours === 24 && minutes === 0) return 1440;
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export function parseOpeningHours(hours: string): { opens: number; closes: number } | 'always' | null {
  if (/^24\s*saat(?:\s+açık)?$/iu.test(hours.trim())) return 'always';
  const match = /^(\d{2}:\d{2})\s*[-–—]\s*(\d{2}:\d{2})$/.exec(hours.trim());
  if (!match) return null;
  const opens = minuteOfDay(match[1]!), closes = minuteOfDay(match[2]!, true);
  if (opens === null || closes === null || opens === closes) return null;
  return opens === 0 && closes === 1440 ? 'always' : { opens, closes };
}

function atMinute(date: Date, minute: number): Date {
  const p = businessParts(date);
  return businessDateTime({ year: p.year, month: p.month, day: p.day, hour: Math.floor(minute / 60), minute: minute % 60 });
}

/** Validate the existing ASAP/HH:mm contract at checkout, including overnight branches. */
export function validatePickupSlot(branch: PickupBranch, label: string, now: Date): void {
  if (!branch.isOpen) throw AppError.branchClosed();
  const hours = parseOpeningHours(branch.hours);
  if (!hours) throw AppError.branchClosed('Şubenin çalışma saatleri doğrulanamadı');
  const p = businessParts(now);
  const currentMinute = p.hour * 60 + p.minute;
  let closesAt: Date | undefined;
  if (hours !== 'always') {
    const overnight = hours.closes < hours.opens;
    const open = overnight
      ? currentMinute >= hours.opens || currentMinute < hours.closes
      : currentMinute >= hours.opens && currentMinute < hours.closes;
    if (!open) throw AppError.branchClosed('Şube çalışma saatleri dışında sipariş verilemez');
    const closeDay = overnight && currentMinute >= hours.opens ? addBusinessDays(now, 1) : now;
    closesAt = atMinute(closeDay, hours.closes);
  }

  const earliest = new Date(now.getTime() + branch.prepMinutes * MINUTE);
  const asap = /^(?:asap|En kısa(?:\s*\(~\d+\s*dk\))?)$/iu.test(label.trim());
  let pickup = earliest;
  if (!asap) {
    const minute = minuteOfDay(label.trim());
    if (minute === null) throw new AppError('VALIDATION_ERROR', 400, 'Geçerli bir teslim saati seçin');
    pickup = atMinute(now, minute);
    if (pickup < now) {
      const tomorrow = atMinute(addBusinessDays(now, 1), minute);
      // Date-less mobile slots only cross midnight into the current overnight opening.
      if ((closesAt && tomorrow < closesAt) || (hours === 'always' && tomorrow.getTime() - now.getTime() <= (branch.prepMinutes + 60) * MINUTE)) {
        pickup = tomorrow;
      }
    }
    if (pickup < earliest) throw new AppError('VALIDATION_ERROR', 400, 'Teslim saati geçti veya hazırlık süresi için çok yakın; yeni bir saat seçin');
  }
  if (closesAt && pickup >= closesAt) throw AppError.branchClosed('Sipariş kapanıştan önce hazırlanamaz; başka bir şube veya teslim saati seçin');
}
