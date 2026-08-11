const steps = [
  {
    label: 'Prepare',
    description: 'Finora assembles the action and its full context.',
  },
  {
    label: 'Policy check',
    description: 'Limits and permissions are checked before approval.',
  },
  {
    label: 'Human approval',
    description: 'You review the amount, destination, rate, and fees.',
  },
  {
    label: 'PIN or biometrics',
    description: 'Identity is confirmed at the point of execution.',
  },
  {
    label: 'Execute + audit',
    description: 'The approved action runs and the outcome is recorded.',
  },
] as const;

export function ApprovalFlow() {
  return (
    <section
      id='safety'
      className='landing-section approval-section'
    >
      <div className='approval-intro'>
        <p className='section-eyebrow'>Autonomy with a hard boundary</p>
        <h2>Helpful enough to prepare the work. Never free to move money alone.</h2>
        <p>
          Finora is designed around an explicit sequence that keeps financial execution behind a
          person, a policy check, and device-level authentication.
        </p>
      </div>

      <ol className='approval-flow'>
        {steps.map((step, index) => (
          <li key={step.label}>
            <div className='approval-index'>{String(index + 1).padStart(2, '0')}</div>
            <div>
              <h3>{step.label}</h3>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
