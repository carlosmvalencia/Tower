import { ENVIRONMENT_LABELS, type Environment } from '../lib/types';

const classes: Record<Environment, string> = {
  FROZEN: 'badge-blue',
  REFRIGERATED: 'badge-cyan',
  DRY: 'badge-amber',
};

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  return <span className={classes[environment]}>{ENVIRONMENT_LABELS[environment]}</span>;
}
