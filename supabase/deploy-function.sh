#!/bin/bash

# ============================================================================
# Supabase Edge Function Deployment Script
# ============================================================================
# This script helps deploy the leave-accruals Edge Function to Supabase
# ============================================================================

set -e

echo "🚀 Deploying leave-accruals Edge Function to Supabase..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo "   Install it with: npm install -g supabase"
    echo "   Or: brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI found"

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "⚠️  Not logged in to Supabase. Please login:"
    echo "   supabase login"
    exit 1
fi

echo "✅ Logged in to Supabase"

# Deploy the function
echo ""
echo "📦 Deploying function..."
supabase functions deploy leave-accruals

echo ""
echo "✅ Function deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Environment variables are automatically provided by Supabase"
echo "      (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected)"
echo ""
echo "   2. Test the function:"
echo "      curl -X POST https://your-project-ref.supabase.co/functions/v1/leave-accruals \\"
echo "        -H \"Authorization: Bearer your-service-role-key\" \\"
echo "        -H \"Content-Type: application/json\" \\"
echo "        -d '{\"accrualType\": \"monthly\"}'"
echo ""
echo "   3. Set up cron schedule (see database/leave-accrual-cron-setup.sql)"
echo ""
echo "📚 For more details, see: supabase/DEPLOYMENT-GUIDE.md"

