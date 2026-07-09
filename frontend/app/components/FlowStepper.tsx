type StepState = "done" | "active" | "idle";

export type FlowStep = {
  id: string;
  label: string;
  state: StepState;
};

export default function FlowStepper({
  steps,
  label = "Progress",
}: {
  steps: FlowStep[];
  label?: string;
}) {
  return (
    <ol className="flow-stepper" aria-label={label}>
      {steps.map((step, index) => (
        <li className={`flow-stepper-item is-${step.state}`} key={step.id}>
          <span className="flow-stepper-index" aria-hidden="true">
            {step.state === "done" ? "✓" : index + 1}
          </span>
          <span className="flow-stepper-label">{step.label}</span>
          {index < steps.length - 1 ? <span className="flow-stepper-connector" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}
