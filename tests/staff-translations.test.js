import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STAFF_PERMISSIONS } from '../shared/adminPermissions.js'
import {
  adminT,
  getAdminLanguage,
  hasAdminLanguagePreference,
  setAdminLanguage
} from '../src/admin/adminI18n.js'

const translations = new Map([
  ['PRODUCT MANAGEMENT', 'ကုန်ပစ္စည်းစီမံခန့်ခွဲမှု'],
  ['Product Management', 'ကုန်ပစ္စည်းစီမံခန့်ခွဲမှု'],
  ['View Products', 'ကုန်ပစ္စည်းကြည့်ရန်'],
  ['Add Products', 'ကုန်ပစ္စည်းအသစ်ထည့်ရန်'],
  ['Edit Products', 'ကုန်ပစ္စည်းပြင်ဆင်ရန်'],
  ['Delete Products', 'ကုန်ပစ္စည်းဖျက်ရန်'],
  ['Manage Categories', 'ကုန်ပစ္စည်းအမျိုးအစားစီမံရန်'],
  ['Manage Subcategories', 'အမျိုးအစားခွဲများစီမံရန်'],
  ['View Stock', 'လက်ကျန်ပစ္စည်းကြည့်ရန်'],
  ['Update Stock', 'လက်ကျန်ပစ္စည်းအရေအတွက်ပြင်ရန်'],
  ['ORDER MANAGEMENT', 'အော်ဒါစီမံခန့်ခွဲမှု'],
  ['View Orders', 'အော်ဒါကြည့်ရန်'],
  ['View Order Details', 'အော်ဒါအသေးစိတ်ကြည့်ရန်'],
  ['Confirm Orders', 'အော်ဒါအတည်ပြုရန်'],
  ['Update Order Status', 'အော်ဒါအခြေအနေပြောင်းရန်'],
  ['Cancel Orders', 'အော်ဒါပယ်ဖျက်ရန်'],
  ['Manage Shipping', 'ပို့ဆောင်ရေးစီမံရန်'],
  ['CUSTOMER MANAGEMENT', 'ဖောက်သည်စီမံခန့်ခွဲမှု'],
  ['Customer Management', 'ဖောက်သည်စီမံခန့်ခွဲမှု'],
  ['View Customers', 'ဖောက်သည်စာရင်းကြည့်ရန်'],
  ['Edit Customer Information', 'ဖောက်သည်အချက်အလက်ပြင်ရန်'],
  ['Manage Customer Support', 'ဖောက်သည်ဝန်ဆောင်မှုစီမံရန်'],
  ['STOREFRONT MANAGEMENT', 'ဆိုင်မျက်နှာစာစီမံခန့်ခွဲမှု'],
  ['Storefront Management', 'ဆိုင်မျက်နှာစာစီမံခန့်ခွဲမှု'],
  ['Manage Banner Images', 'ကြော်ငြာပုံများစီမံရန်'],
  ['Manage Home Sections', 'ပင်မစာမျက်နှာအပိုင်းများစီမံရန်'],
  ['Manage Home Layout', 'ပင်မစာမျက်နှာပုံစံပြင်ရန်'],
  ['NOTIFICATIONS', 'အသိပေးချက်များ'],
  ['View Notifications', 'အသိပေးချက်ကြည့်ရန်'],
  ['Send Notifications', 'အသိပေးချက်ပို့ရန်']
])

test('all staff permission names and headings display in Burmese', () => {
  for (const [english, burmese] of translations) {
    assert.equal(adminT(english, 'my'), burmese)
  }

  for (const permission of STAFF_PERMISSIONS) {
    assert.match(adminT(permission.label, 'my'), /[\u1000-\u109F]/, permission.key)
    assert.match(adminT(permission.group, 'my'), /[\u1000-\u109F]/, permission.group)
  }

  for (const label of [
    'Staff Account Management',
    'Staff Management',
    'Add New Staff',
    'Staff Permissions',
    'Staff Activity Logs',
    'Configure Individual Staff Permissions',
    'Save Permissions',
    'Deactivate Account',
    'Activate Account'
  ]) {
    assert.match(adminT(label, 'my'), /[\u1000-\u109F]/, label)
  }

  for (const label of [
    'Add New Staff',
    'Staff Activity Logs',
    'Staff Name',
    'Username',
    'Initial Password',
    'Create Staff Account',
    'Passwords are stored as salted scrypt hashes. The account starts with no permissions.',
    'Save Information',
    'Change Password',
    'Status',
    'Assigned Permissions',
    'Last Login',
    'Created Date',
    'Never',
    'Active',
    'Inactive',
    'No Staff accounts created. {count} slots are available.',
    'Staff account',
    'Staff management',
    'Logs are recorded by the server and cannot be edited or deleted by Staff.',
    'Staff',
    'Action',
    'Date and Time',
    'Affected Record',
    'Activity Details',
    'No Staff accounts are available.',
    'No Staff activity has been recorded.',
    'Staff account created.',
    'Unable to create Staff account.',
    'Unable to load Staff accounts.',
    'Unable to load Staff activity logs.',
    'Unable to update Staff account.',
    'Unable to update Staff account status.',
    'Unable to change Staff password.',
    'Unable to save Staff permissions.',
    'Staff account not found.',
    'Enter a valid name, username, and active status.',
    'Enter your Staff username and password.',
    'Staff account deactivated.',
    'Staff account activated.',
    'Staff password changed; existing Staff sessions were revoked.',
    'Permissions saved; existing Staff sessions were revoked.',
    'Owner access is required.',
    'You do not have permission to perform this action.',
    'This feature is available to the Owner only.',
    'Staff Dashboard',
    'Operational overview based on your assigned permissions.',
    'Assigned Access',
    'Your available dashboard sections are shown in the sidebar.',
    'No dashboard data is available for your current permissions.',
    'Low Stock',
    'Staff Username',
    'Staff Password',
    'STAFF DASHBOARD ACCESS',
    'Sign in with your Staff username and password.'
  ]) {
    assert.match(adminT(label, 'my'), /[\u1000-\u109F]/, label)
  }
})

test('Staff pages default to Burmese without overriding an explicit language choice', () => {
  const saved = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value)
    }
  }

  assert.equal(hasAdminLanguagePreference(), false)
  assert.equal(getAdminLanguage('my'), 'my')
  assert.equal(setAdminLanguage('en'), 'en')
  assert.equal(hasAdminLanguagePreference(), true)
  assert.equal(getAdminLanguage('my'), 'en')
  assert.equal(setAdminLanguage('my'), 'my')
  assert.equal(getAdminLanguage('en'), 'my')
  delete globalThis.window
})
