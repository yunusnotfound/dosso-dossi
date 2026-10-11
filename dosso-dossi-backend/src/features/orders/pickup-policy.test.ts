import { describe, expect, it } from 'vitest';
import { isAcceptingOrders, validatePickupSlot } from './pickup-policy.js';
import { addBusinessDays, businessDayKey, businessHour, startOfBusinessDay } from '../../lib/business-time.js';

const branch = { isOpen: true, hours: '08:00–01:00', prepMinutes: 7 };
const at = (time: string) => new Date(`2026-10-07T${time}:00+03:00`);

describe('Türkiye teslim zamanı kuralları', () => {
  it('yerel sunucu saatinden bağımsız Türkiye gününü ve geceyarısını bulur', () => {
    const instant = new Date('2026-10-06T22:30:00Z');
    expect(businessDayKey(instant)).toBe('2026-10-07');
    expect(businessHour(instant)).toBe(1);
    expect(startOfBusinessDay(instant).toISOString()).toBe('2026-10-06T21:00:00.000Z');
    expect(addBusinessDays(instant, 1).toISOString()).toBe('2026-10-07T21:00:00.000Z');
  });
  it('geçmiş, hatalı veya hazırlık süresinden yakın teslimi reddeder', () => {
    for (const slot of ['10:00', '12:05', '25:00', 'yarın']) {
      expect(() => validatePickupSlot(branch, slot, at('12:00'))).toThrow();
    }
    expect(() => validatePickupSlot(branch, '12:15', at('12:00'))).not.toThrow();
  });
  it('gece açık şubede ertesi günün ilk saatlerini kabul eder, kapanış sonrasını reddeder', () => {
    expect(() => validatePickupSlot(branch, '00:15', at('23:50'))).not.toThrow();
    expect(() => validatePickupSlot(branch, '01:00', at('23:50'))).toThrow();
    expect(() => validatePickupSlot(branch, 'En kısa (~7 dk)', at('00:55'))).toThrow();
    expect(() => validatePickupSlot(branch, 'asap', at('04:00'))).toThrow();
  });
  it('24:00 kapanışını ve 24 saat açık şubeyi farklı değerlendirir', () => {
    expect(() => validatePickupSlot({ ...branch, hours: '08:00–24:00' }, '00:15', at('23:50'))).toThrow();
    expect(() => validatePickupSlot({ ...branch, hours: '24 saat açık' }, '00:15', at('23:50'))).not.toThrow();
    expect(() => validatePickupSlot({ ...branch, hours: '24 saat açık' }, '11:45', at('12:00'))).toThrow();
  });
  it('kapalı ve geçersiz çalışma saatli şube için tahsilata izin vermez', () => {
    expect(() => validatePickupSlot({ ...branch, isOpen: false }, 'asap', at('12:00'))).toThrow();
    expect(() => validatePickupSlot({ ...branch, hours: 'belirsiz' }, 'asap', at('12:00'))).toThrow();
  });

  it('açık rozeti teslim doğrulaması ve hazırlık süresiyle aynı sınırları kullanır', () => {
    for (const time of ['00:30', '00:53', '00:54', '01:00', '07:59', '08:00', '23:59']) {
      let accepted = true;
      try { validatePickupSlot(branch, 'asap', at(time)); } catch { accepted = false; }
      expect(isAcceptingOrders(branch, at(time)), time).toBe(accepted);
    }
    expect(isAcceptingOrders(branch, at('00:53'))).toBe(false);
    expect(isAcceptingOrders({ ...branch, isOpen: false }, at('12:00'))).toBe(false);
    expect(isAcceptingOrders({ ...branch, hours: 'hatalı' }, at('12:00'))).toBe(false);
    expect(isAcceptingOrders({ ...branch, hours: '24 saat açık' }, at('23:59'))).toBe(true);
  });
});
