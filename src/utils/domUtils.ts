import type { Maybe } from '../types';

export function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function scrollIntoView(element: Maybe<Element>, behavior: ScrollBehavior = 'instant') {
  element?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior });
}

export function scrollIntoViewV2(element: Maybe<Element>, behavior: ScrollBehavior = 'instant') {
  element?.scrollIntoView({ inline: 'center', block: 'center', behavior });
}
