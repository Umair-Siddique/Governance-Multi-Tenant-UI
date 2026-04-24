import React, { useState, useEffect } from 'react';
import ReviewerLayout from './ReviewerLayout';
import { getTenantProfile, normalizeTenantProfile } from '../../api/tenantSettings';

export default function ReviewerSettings() {
  const [tenant, setTenant] = useState({
    tenant_name: '',
    tenant_type: 'self_managed',
    tenant_details: {
      country: '',
      contact_email: '',
      department: '',
    }
  });
  const [tenantExists, setTenantExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const p = await getTenantProfile();
        const tenantData = normalizeTenantProfile(p);
        if (tenantData) {
          setTenantExists(true);
          setTenant(tenantData);
        } else if (p?.notFound) {
          setTenantExists(false);
        }
      } catch (e) {
        console.error('Error loading tenant profile:', e);
        setTenantExists(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ReviewerLayout title="Settings">
      <div className="max-w-4xl mx-auto">
        {/* Tenant Details Section */}
        <div className="bg-background-surface shadow rounded-lg overflow-hidden border border-border-default">
          <div className="px-6 py-5 border-b border-border-default">
            <h3 className="text-lg font-medium leading-6 text-text-primary">Tenant Details</h3>
            <p className="mt-1 text-sm text-text-muted">Your tenant profile information.</p>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center text-text-muted py-8">Loading tenant details…</div>
            ) : !tenantExists ? (
              <div className="text-center text-text-muted py-8">
                No tenant profile found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                {/* Tenant Name */}
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-text-muted">Tenant name</label>
                  <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary">
                    {tenant.tenant_name || '—'}
                  </p>
                </div>

                {/* Tenant Type */}
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-text-muted">Tenant type</label>
                  <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary capitalize">
                    {tenant.tenant_type === 'self_managed'
                      ? 'Self-managed'
                      : tenant.tenant_type === 'managed'
                        ? 'Managed'
                        : tenant.tenant_type === 'white_label'
                          ? 'White label'
                          : tenant.tenant_type || '—'}
                  </p>
                </div>

                {/* Department */}
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-text-muted">Department</label>
                  <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary">
                    {tenant.tenant_details?.department || '—'}
                  </p>
                </div>

                {/* Country */}
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-text-muted">Country</label>
                  <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary">
                    {tenant.tenant_details?.country || '—'}
                  </p>
                </div>

                {/* Contact Email */}
                <div className="sm:col-span-6">
                  <label className="block text-sm font-medium text-text-muted">Contact email</label>
                  <p className="mt-1 block w-full border border-border-default rounded-md bg-background-subtle px-3 py-2 text-sm text-text-primary">
                    {tenant.tenant_details?.contact_email || '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ReviewerLayout>
  );
}
