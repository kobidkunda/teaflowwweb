"use client";

import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import { Check } from "lucide-react";

export type StepNumber = 1 | 2 | 3;

interface StepDef {
  num: StepNumber;
  label: string;
  href?: string;
}

const STEPS: StepDef[] = [
  { num: 1, label: "Bag", href: "/cart" },
  { num: 2, label: "Details", href: "/checkout" },
  { num: 3, label: "Confirmation" },
];

export function CheckoutSteps({ currentStep }: { currentStep: StepNumber }) {
  return (
    <nav aria-label="Checkout progress" className="checkout-stepper-nav">
      <ol className="checkout-stepper-list">
        {STEPS.map((step, idx) => {
          const isCurrent = step.num === currentStep;
          const isComplete = step.num < currentStep;
          const isUpcoming = step.num > currentStep;
          const isClickable = isComplete && step.href;

          return (
            <li
              key={step.num}
              className={`checkout-stepper-item ${isCurrent ? "is-current" : ""} ${isComplete ? "is-complete" : ""} ${isUpcoming ? "is-upcoming" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {idx > 0 && (
                <div
                  className={`checkout-stepper-connector ${isComplete || isCurrent ? "is-active" : ""}`}
                  aria-hidden="true"
                />
              )}

              <div className="checkout-stepper-node">
                <span className="checkout-stepper-badge" aria-hidden="true">
                  {isComplete ? (
                    <Check size={14} strokeWidth={2.8} className="stepper-check-icon" />
                  ) : (
                    <span>{step.num}</span>
                  )}
                </span>

                {isClickable ? (
                  <Link href={step.href!} className="checkout-stepper-label is-link">
                    {step.label}
                  </Link>
                ) : (
                  <span className="checkout-stepper-label">{step.label}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
