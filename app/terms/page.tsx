export default function TermsPage() {
  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto space-y-4 text-sm leading-relaxed text-white/80">
      <h1 className="text-2xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-xs text-amber-300">DRAFT — Marked for legal review before launch.</p>
      <p className="text-xs text-white/40">Last updated: {new Date().toLocaleDateString()}</p>

      <h2 className="text-lg font-semibold pt-3">1. Acceptance</h2>
      <p>By accessing or using VITALS (&quot;the Service&quot;), you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

      <h2 className="text-lg font-semibold pt-3">2. Not Medical Advice</h2>
      <p>VITALS is a personal information and tracking tool. It is NOT a medical device, clinical service, or substitute for professional medical advice, diagnosis, or treatment. AI-generated insights are informational only.</p>
      <p>Always seek the advice of a qualified healthcare practitioner with any questions you may have regarding a medical condition, medication, hormone, peptide, or supplement.</p>

      <h2 className="text-lg font-semibold pt-3">3. Eligibility</h2>
      <p>You must be at least 18 years old to use VITALS. By using the Service you represent that you are of legal age.</p>

      <h2 className="text-lg font-semibold pt-3">4. User Responsibilities</h2>
      <p>You are solely responsible for: (a) the accuracy of data you enter, (b) any substances, protocols, or interventions you undertake, (c) consulting qualified clinicians before acting on tracked patterns or AI suggestions.</p>

      <h2 className="text-lg font-semibold pt-3">5. AI Output</h2>
      <p>AI-generated content may contain errors, omissions, or out-of-date information. VITALS will not name specific drug doses for standalone users; recommendations are framed as information for clinician discussion. You agree to use AI output only as a discussion starting point.</p>

      <h2 className="text-lg font-semibold pt-3">6. Intellectual Property &amp; Ownership</h2>
      <p>VITALS, including all software, source code, AI prompts, models in use, designs, UI, copy, logos, the name &quot;VITALS&quot;, and all associated content (collectively the &quot;Proprietary Materials&quot;), is the exclusive property of Vincenzo Ricco / VITALS and is protected by copyright, trademark, trade-secret, and other intellectual property laws. All rights reserved.</p>
      <p>You are granted a limited, non-exclusive, non-transferable, revocable license to use the Service for personal, non-commercial purposes. You may NOT, directly or indirectly: (a) copy, reproduce, reverse engineer, decompile, disassemble, or attempt to derive the source code or underlying ideas of the Service; (b) modify, adapt, translate, or create derivative works of any Proprietary Materials; (c) build a competing product or service using any portion of the Service, its prompts, its outputs, or its structure; (d) scrape, harvest, or systematically download data, AI outputs, or pages from the Service; (e) use any VITALS marks, logos, or branding without prior written permission.</p>
      <p>Feedback, suggestions, or ideas you provide about the Service may be used by VITALS without restriction and without obligation to you. Content you create (your logs, photos, journal entries, body comp data) remains yours; you grant VITALS a limited license to store, process, and display it solely to provide the Service to you.</p>
      <p>Violation of this section is a material breach of these Terms and entitles VITALS to terminate your access immediately and pursue all available legal and equitable remedies.</p>

      <h2 className="text-lg font-semibold pt-3">7. Subscriptions and Payment</h2>
      <p>Paid plans (Pro, Premium) are billed monthly or yearly via Stripe. You may cancel anytime; cancellation takes effect at the end of the current billing period. Trials convert to Free on day 14 unless upgraded.</p>

      <h2 className="text-lg font-semibold pt-3">8. Data and Privacy</h2>
      <p>See our Privacy Policy. Your tracked data is encrypted at rest in Supabase with row-level security; only you can access your own records.</p>

      <h2 className="text-lg font-semibold pt-3">9. Disclaimer of Warranties</h2>
      <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND. VITALS DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR DIAGNOSTICALLY ACCURATE.</p>

      <h2 className="text-lg font-semibold pt-3">10. Limitation of Liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, VITALS AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, USE, OR PROFITS.</p>

      <h2 className="text-lg font-semibold pt-3">11. Changes</h2>
      <p>We may update these Terms; continued use after updates constitutes acceptance.</p>

      <h2 className="text-lg font-semibold pt-3">12. Contact</h2>
      <p>Questions: contact via the in-app feedback channel.</p>
    </div>
  )
}
