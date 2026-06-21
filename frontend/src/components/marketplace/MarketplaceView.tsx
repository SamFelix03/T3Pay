"use client";

import type { Product } from "@/lib/types";
import { MARKETPLACE_USE_CASES, groupProductsByUseCase } from "@/lib/marketplace";
import { money } from "@/lib/format";

type Props = {
  products: Product[];
};

export function MarketplaceView({ products }: Props) {
  const grouped = groupProductsByUseCase(products);

  return (
    <div className="view-stack marketplace-view">
      <section className="surface-card marketplace-intro">
        <span className="section-label">Catalog</span>
        <h2>Agent-ready services</h2>
        <p>
          VaultPay agents shop through policy-scoped mandates. Each use case maps to live merchant services with
          inventory, pricing, and T3N-sealed checkout.
        </p>
      </section>

      {MARKETPLACE_USE_CASES.map((useCase) => {
        const services = grouped[useCase.id];
        return (
          <section key={useCase.id} className="surface-card marketplace-use-case">
            <div className="marketplace-use-case-head">
              <div>
                <span className="section-label">{useCase.label}</span>
                <h3>{useCase.objective}</h3>
                <p>{useCase.description}</p>
              </div>
              <div className="marketplace-merchant-chips">
                {useCase.merchants.map((merchant) => (
                  <span key={merchant.id} className="merchant-chip">
                    {merchant.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="marketplace-service-grid">
              {services.length ? (
                services.map((service) => (
                  <article key={service.id} className="marketplace-service-card">
                    <div className="marketplace-service-icon" aria-hidden>
                      {useCase.id === "electronics" ? "⚡" : useCase.id === "groceries" ? "🛒" : "✈️"}
                    </div>
                    <div className="marketplace-service-copy">
                      <strong>{service.name}</strong>
                      <span>{service.merchant_name}</span>
                      <span className="marketplace-service-price">
                        {money(service.price_cents)} {service.currency}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-state">No services seeded for this use case yet.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
