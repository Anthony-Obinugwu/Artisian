import { describe, it, expect } from 'vitest';
import { artisanCreateSchema, artisanUpdateSchema } from '../validators/artisan';

describe('Artisan Request Payload Validation', () => {
  it('validates a valid artisan creation payload', () => {
    const validData = {
      business_name: 'FastFix Vulcanizers',
      owner_name: 'Musa Ibrahim',
      phone: '08012345678',
      latitude: 6.5244,
      longitude: 3.3792,
      category: 'vulcanizer',
      mobility_type: 'STATIC',
      services: ['Tire Repair', 'Air Inflation'],
    };

    const result = artisanCreateSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.business_name).toBe('FastFix Vulcanizers');
      expect(result.data.latitude).toBe(6.5244);
    }
  });

  it('rejects payload missing required business_name', () => {
    const invalidData = {
      owner_name: 'Musa Ibrahim',
      latitude: 6.5244,
      longitude: 3.3792,
    };

    const result = artisanCreateSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('transforms string coordinates to numbers correctly', () => {
    const stringCoordsData = {
      business_name: 'TopNotch Tailors',
      latitude: '6.4531',
      longitude: '3.3958',
      category: 'tailor',
    };

    const result = artisanCreateSchema.safeParse(stringCoordsData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.latitude).toBe(6.4531);
      expect(result.data.longitude).toBe(3.3958);
    }
  });
});
