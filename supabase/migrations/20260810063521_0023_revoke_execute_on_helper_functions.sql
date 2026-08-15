/*
# Revoke EXECUTE on SECURITY DEFINER helper functions

## Problem
The `is_company_member` and `is_setup_in_progress` functions are SECURITY DEFINER
and callable via the REST API by anon/authenticated roles. They should only be
used internally in RLS policies, not directly callable.

## Solution
Revoke EXECUTE from anon and authenticated roles on both functions.
*/

REVOKE EXECUTE ON FUNCTION is_company_member(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION is_setup_in_progress() FROM anon, authenticated;
