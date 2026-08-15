/*
# Fix function search paths

## Overview
Sets the search_path on the two helper functions to public to resolve
the "Function Search Path Mutable" security advisor warning.

## Changes
- ALTER FUNCTION set_updated_at() SET search_path = public
- ALTER FUNCTION audit_log_trigger() SET search_path = public
*/

ALTER FUNCTION set_updated_at() SET search_path = public;
ALTER FUNCTION audit_log_trigger() SET search_path = public;
