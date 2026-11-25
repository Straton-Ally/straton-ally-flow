import { describe, expect, it } from 'vitest';
import type { AccessRole, AuthUser } from '@/lib/auth';
import { can, roleLabel, type Permission } from '@/lib/permissions';

function user(accessRole: AccessRole, extra: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    email: 'someone@stratonally.com',
    fullName: 'Some One',
    role: accessRole === 'member' ? 'employee' : 'admin',
    accessRole,
    isTeamLead: accessRole === 'manager',
    officeId: null,
    employeeId: null,
    avatarUrl: null,
    canAccessFlowMath: false,
    canAccessFlowPay: false,
    ...extra,
  };
}

const everyone: Permission[] = ['chat.use', 'projects.use', 'attendance.self', 'notifications.view'];
const leadsOnly: Permission[] = ['projects.create', 'attendance.team', 'people.view', 'salaries.view'];
const adminOnly: Permission[] = ['people.manage', 'departments.manage', 'permissions.manage', 'logs.view', 'settings.manage'];

describe('can()', () => {
  it('denies everything when signed out', () => {
    for (const p of [...everyone, ...leadsOnly, ...adminOnly]) expect(can(null, p)).toBe(false);
  });

  it('gives members only the basics', () => {
    const member = user('member');
    for (const p of everyone) expect(can(member, p)).toBe(true);
    for (const p of [...leadsOnly, ...adminOnly]) expect(can(member, p)).toBe(false);
  });

  it('gives managers team tools but not admin settings', () => {
    const manager = user('manager');
    for (const p of [...everyone, ...leadsOnly]) expect(can(manager, p)).toBe(true);
    for (const p of adminOnly) expect(can(manager, p)).toBe(false);
  });

  it('gives admins everything role-based', () => {
    const admin = user('admin');
    for (const p of [...everyone, ...leadsOnly, ...adminOnly]) expect(can(admin, p)).toBe(true);
  });

  it('uses per-user flags for FlowMath and FlowPay, not the role', () => {
    expect(can(user('admin'), 'flowmath.use')).toBe(false);
    expect(can(user('member', { canAccessFlowMath: true }), 'flowmath.use')).toBe(true);
    expect(can(user('member', { canAccessFlowPay: true }), 'flowpay.use')).toBe(true);
    expect(can(user('manager'), 'flowpay.use')).toBe(false);
  });
});

describe('roleLabel()', () => {
  it('labels each role and defaults to Member', () => {
    expect(roleLabel('admin')).toBe('Admin');
    expect(roleLabel('manager')).toBe('Manager');
    expect(roleLabel('member')).toBe('Member');
    expect(roleLabel(undefined)).toBe('Member');
  });
});
