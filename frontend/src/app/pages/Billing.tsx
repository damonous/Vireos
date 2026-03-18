import { useMemo, useState } from 'react';
import { Check, CreditCard, ExternalLink, Receipt, Wallet } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api-client';

interface PlanResponse {
  plans: Array<{
    id: string;
    name: string;
    priceId: string;
    amount: number;
    features: string[];
  }>;
  bundles: Array<{
    id: string;
    label: string;
    credits: number;
    amount: number;
  }>;
}

interface SubscriptionRecord {
  id: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface CreditBalanceResponse {
  balance: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }>;
}

interface InvoiceRecord {
  id: string;
  created: number;
  status: string | null;
  amount_paid: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  number: string | null;
}

function formatMoney(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCents(amount: number, currency = 'usd'): string {
  return formatMoney(amount / 100, currency);
}

export default function Billing() {
  const { user } = useAuth();
  const plans = useApiData<PlanResponse>('/billing/plans');
  const subscription = useApiData<SubscriptionRecord | null>('/billing/subscription');
  const creditBalance = useApiData<CreditBalanceResponse>('/billing/credits/balance');
  const invoices = useApiData<InvoiceRecord[]>('/billing/invoices');
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const statusMessage = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') === 'required') return 'Choose a subscription plan to complete onboarding and unlock the workspace.';
    if (params.get('required') === 'subscription') return 'An active subscription is required before you can access the rest of the application.';
    if (params.get('checkout') === 'success') return 'Checkout returned successfully. Stripe webhook confirmation updates subscription state afterward.';
    if (params.get('checkout') === 'cancelled') return 'Checkout was cancelled before completion.';
    if (params.get('portal') === 'returned') return 'Returned from the billing portal.';
    return null;
  }, []);

  const isLoading =
    plans.loading || subscription.loading || creditBalance.loading || invoices.loading;
  const error = plans.error || subscription.error || creditBalance.error || invoices.error;

  if (isLoading) {
    return <LoadingState label="Loading billing..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          void plans.reload();
          void subscription.reload();
          void creditBalance.reload();
          void invoices.reload();
        }}
      />
    );
  }

  const planList = plans.data?.plans ?? [];
  const bundleList = plans.data?.bundles ?? [];
  const currentSubscription = subscription.data;
  const currentPlan =
    planList.find((plan) => plan.priceId === currentSubscription?.stripePriceId) ?? planList[0] ?? null;
  const balance = creditBalance.data?.balance ?? 0;
  const transactions = creditBalance.data?.transactions ?? [];
  const invoiceRows = invoices.data ?? [];
  const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  const runBillingAction = async (
    actionKey: string,
    request: () => Promise<{ url: string }>
  ) => {
    setProcessingAction(actionKey);
    setActionError(null);
    try {
      const result = await request();
      window.location.assign(result.url);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Billing action failed.');
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Billing & Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">Live billing state, credits, and Stripe invoice history</p>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {statusMessage ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {statusMessage}
          </div>
        ) : null}
        {actionError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <Card className="p-6 rounded-lg shadow-sm border-2 border-[#0EA5E9] bg-gradient-to-br from-blue-50 to-white xl:col-span-2">
            <div className="flex items-start justify-between gap-6 mb-6">
              <div>
                <p className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-wide mb-2">Current Plan</p>
                <h3 className="text-2xl font-semibold text-[#1E3A5F]">{currentPlan?.name ?? 'No active paid plan'}</h3>
                <p className="text-3xl font-bold text-[#1E3A5F] mt-2">
                  {currentPlan ? `${formatCents(currentPlan.amount)}/month` : 'Trial'}
                </p>
                <p className="text-sm text-gray-600 mt-3">
                  Status: {currentSubscription?.status ?? user?.organization?.subscriptionStatus ?? 'TRIALING'}
                </p>
                {currentSubscription?.currentPeriodEnd ? (
                  <p className="text-sm text-gray-500 mt-1">
                    Renews {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
              <div className="w-14 h-14 bg-white rounded-xl border border-blue-100 flex items-center justify-center">
                <CreditCard className="w-7 h-7 text-[#0EA5E9]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {planList.map((plan) => (
                <div key={plan.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[#1E3A5F]">{plan.name}</p>
                    <p className="text-sm font-semibold text-[#0EA5E9]">
                      {plan.amount > 0 ? `${formatCents(plan.amount)}/mo` : 'Custom pricing'}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-700 mb-3">Credit Bundles</p>
              <div className="flex flex-wrap gap-3">
                {bundleList.map((bundle) => (
                  <span key={bundle.id} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                    <Wallet className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
                    {bundle.label} • {formatCents(bundle.amount)}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              {isAdmin ? (
                <div className="flex flex-wrap gap-3">
                  {planList.map((plan) => (
                    <Button
                      key={plan.id}
                      variant={currentPlan?.priceId === plan.priceId ? 'secondary' : 'default'}
                      className={currentPlan?.priceId === plan.priceId ? 'bg-white border border-gray-300 text-[#1E3A5F]' : 'bg-[#0EA5E9] hover:bg-[#0284C7] text-white'}
                      onClick={() => void runBillingAction(`checkout:${plan.priceId}`, () => apiClient.post('/billing/checkout', { priceId: plan.priceId }))}
                      disabled={processingAction === `checkout:${plan.priceId}`}
                    >
                      {processingAction === `checkout:${plan.priceId}` ? 'Redirecting...' : `Choose ${plan.name}`}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => void runBillingAction('portal', () => apiClient.post('/billing/portal'))}
                    disabled={processingAction === 'portal'}
                  >
                    {processingAction === 'portal' ? 'Opening...' : 'Open Billing Portal'}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  You have read-only access to billing details for this organization.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Credits</h3>
            <div className="rounded-xl bg-slate-900 text-white p-5 mb-5">
              <p className="text-sm text-slate-300">Current Balance</p>
              <p className="text-4xl font-semibold mt-2">{balance.toLocaleString()}</p>
              <p className="text-sm text-slate-300 mt-2">Latest org credit balance from the backend</p>
            </div>
            <div className="space-y-3">
              {isAdmin ? (
                <div className="grid grid-cols-1 gap-2">
                  {bundleList.map((bundle) => (
                    <Button
                      key={bundle.id}
                      variant="outline"
                      className="justify-between"
                      onClick={() => void runBillingAction(`bundle:${bundle.id}`, () => apiClient.post('/billing/credits/purchase', { bundleId: bundle.id }))}
                      disabled={processingAction === `bundle:${bundle.id}`}
                    >
                      <span>{bundle.label}</span>
                      <span>{processingAction === `bundle:${bundle.id}` ? 'Redirecting...' : formatCents(bundle.amount)}</span>
                    </Button>
                  ))}
                </div>
              ) : null}
              {transactions.slice(0, 4).map((transaction) => (
                <div key={transaction.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <div>
                    <p className="text-sm font-medium text-[#1E3A5F]">{transaction.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(transaction.createdAt).toLocaleString()} • {transaction.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.amount >= 0 ? '+' : ''}
                      {transaction.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">Bal {transaction.balanceAfter.toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {transactions.length === 0 ? (
                <EmptyState title="No credit activity yet" description="Credit purchases and deductions will appear here." />
              ) : null}
            </div>
          </Card>
        </div>

        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Invoice History</h3>
          </div>
          {invoiceRows.length === 0 ? (
            <div className="p-10">
              <EmptyState
                title="No Stripe invoices yet"
                description="This organization does not have a Stripe customer or issued invoices yet."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Invoice</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4 text-sm text-[#1E3A5F] font-medium">
                        {invoice.number ?? invoice.id}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {new Date(invoice.created * 1000).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {formatCents(invoice.amount_paid, invoice.currency)}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700">
                          <Receipt className="w-3 h-3" />
                          {invoice.status ?? 'unknown'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {invoice.hosted_invoice_url || invoice.invoice_pdf ? (
                          <a
                            className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:text-[#0284C7]"
                            href={invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
