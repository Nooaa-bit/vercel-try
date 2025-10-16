//app/terms/page.tsx
export default function TermsPage() {
  return (
    <div className="pt-10 pb-8">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>

        <section className="prose max-w-none space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Acceptance of Terms</h2>
            <p>By using HypeHire, you agree to these terms of service.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Our Services</h2>
            <p>
              HypeHire provides on-demand staffing solutions connecting
              companies with qualified workers.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">
              User Responsibilities
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide accurate information during registration</li>
              <li>Maintain confidentiality of account credentials</li>
              <li>Comply with all assigned duties and schedules</li>
              <li>Report issues promptly to supervisors</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Account Termination</h2>
            <p>
              Either party may terminate the relationship at any time. Data
              deletion follows our privacy policy.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Contact</h2>
            <p>For questions: legal@hypehire.com</p>
            <p>
              <strong>Last updated:</strong> September 22, 2025
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
