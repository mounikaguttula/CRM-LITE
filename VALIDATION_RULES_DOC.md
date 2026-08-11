# 📋 CRM Lite - Validation Rules Specification & QA Test Matrix

This document provides a complete technical specification and QA testing matrix for all **System Validation Rules** implemented in CRM Lite.

---

## 🎯 1. Lead Object Validation Rules

### Rule 1.1: Company Required For Qualified Leads
- **Rule Key**: `lead_company_required_for_qualified_lead`
- **Rule Name**: `Company_Required_For_Qualified_Lead`
- **Target Object**: `Lead` (`lead`)
- **Trigger Condition**: `status` = `"Qualified"` AND `company` = `IS_BLANK`
- **Error Message**: `"Company is required when the lead status is Qualified."`

#### QA Test Cases:
| Test Case ID | Lead Status | Company Field Value | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **TC-LEAD-01** | `Qualified` | Blank / Empty | ❌ **FAIL** (Triggers error message) |
| **TC-LEAD-02** | `Qualified` | `"TechNova Solutions"` | ✅ **PASS** (Record created/updated successfully) |
| **TC-LEAD-03** | `New` | Blank / Empty | ✅ **PASS** (Company optional for non-Qualified leads) |

---

### Rule 1.2: Valid Email Address Format
- **Rule Key**: `lead_valid_email_format`
- **Rule Name**: `Valid_Email_Format`
- **Target Object**: `Lead` (`lead`)
- **Trigger Condition**: `email` `IS_NOT_BLANK` AND `email` `NOT_REGEX` `"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"`
- **Error Message**: `"Please enter a valid email address (e.g. user@company.com)."`

#### QA Test Cases:
| Test Case ID | Email Address Value | Expected Outcome |
| :--- | :--- | :--- |
| **TC-LEAD-04** | `bhanu@techmantranow.com` | ✅ **PASS** (Valid email accepted) |
| **TC-LEAD-05** | Blank / Empty | ✅ **PASS** (Blank email accepted if not required) |
| **TC-LEAD-06** | `bhanu_invalid_email` | ❌ **FAIL** (Triggers valid email format error) |
| **TC-LEAD-07** | `user@company` | ❌ **FAIL** (Missing top-level domain extension) |

---

## 💼 2. Deal Object Validation Rules

### Rule 2.1: Positive Deal Amount Required
- **Rule Key**: `deal_positive_amount_required`
- **Rule Name**: `Positive_Amount_Required`
- **Target Object**: `Deal` (`deal`)
- **Trigger Condition**: `amount` `<` `0` (Numeric comparison)
- **Error Message**: `"Deal amount cannot be negative."`

#### QA Test Cases:
| Test Case ID | Amount Field Value | Expected Outcome |
| :--- | :--- | :--- |
| **TC-DEAL-01** | Blank / Empty string | ✅ **PASS** (Blank amount does NOT trigger negative error) |
| **TC-DEAL-02** | `0` | ✅ **PASS** (Zero amount allowed) |
| **TC-DEAL-03** | `5000` | ✅ **PASS** (Positive numeric amount allowed) |
| **TC-DEAL-04** | `-100` | ❌ **FAIL** (Triggers `"Deal amount cannot be negative."`) |

---

### Rule 2.2: Discount Percentage Range
- **Rule Key**: `deal_discount_percentage_range`
- **Rule Name**: `Discount_Percentage_Range`
- **Target Object**: `Deal` (`deal`)
- **Trigger Condition**: `discount` `>` `100`
- **Error Message**: `"Discount percentage must be between 0% and 100%."`

#### QA Test Cases:
| Test Case ID | Discount Percentage Value | Expected Outcome |
| :--- | :--- | :--- |
| **TC-DEAL-05** | Blank / `0` / `25` / `100` | ✅ **PASS** (Valid discount percentage accepted) |
| **TC-DEAL-06** | `150` | ❌ **FAIL** (Triggers percentage range error) |

---

### Rule 2.3: Loss Reason Required On Closed Lost
- **Rule Key**: `deal_loss_reason_required_on_closed_lost`
- **Rule Name**: `Loss_Reason_Required_On_Closed_Lost`
- **Target Object**: `Deal` (`deal`)
- **Trigger Condition**: `stage` = `"Closed Lost"` AND `loss_reason` = `IS_BLANK`
- **Error Message**: `"Loss Reason is required when a deal is marked as Closed Lost."`

#### QA Test Cases:
| Test Case ID | Deal Stage | Loss Reason Field Value | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **TC-DEAL-07** | `Closed Lost` | Blank / Empty | ❌ **FAIL** (Triggers loss reason error) |
| **TC-DEAL-08** | `Closed Lost` | `"Competitor offered lower price"` | ✅ **PASS** (Record updated successfully) |
| **TC-DEAL-09** | `Qualification` | Blank / Empty | ✅ **PASS** (Loss reason not needed for active deals) |

---

## 👤 3. Contact Object Validation Rules

### Rule 3.1: Birth Date Past Only
- **Rule Key**: `contact_birth_date_past_only`
- **Rule Name**: `Birth_Date_Past_Only`
- **Target Object**: `Contact` (`contact`)
- **Trigger Condition**: `birth_date` `DATE_FUTURE`
- **Error Message**: `"Birth date cannot be set in the future."`

#### QA Test Cases:
| Test Case ID | Birth Date Field Value | Expected Outcome |
| :--- | :--- | :--- |
| **TC-CONTACT-01** | `1995-05-15` (Past date) | ✅ **PASS** (Valid birth date accepted) |
| **TC-CONTACT-02** | Today's Date | ✅ **PASS** (Valid birth date accepted) |
| **TC-CONTACT-03** | `2030-01-01` (Future date) | ❌ **FAIL** (Triggers future birth date error) |

---

## ⚙️ 4. Technical Engine Features
- **Dynamic Field Lookup**: Evaluates target fields case-insensitively across top-level record columns and `record.data` JSON payload.
- **Tenant Scope & Overrides**: System rules apply platform-wide unless overridden by an organization-specific rule with a matching `rule_key`.
- **Numeric Handling**: Numeric operators (`less_than`, `greater_than`, etc.) return `false` on blank values to prevent false positive errors on optional numeric fields.
