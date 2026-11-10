import type { CSSProperties, ReactNode, Ref } from 'react';

declare module '@/components/react-bits/FadeContent' {
  export default function FadeContent(props: {
    children?: ReactNode;
    container?: string | HTMLElement | null;
    effect?: string;
    blur?: boolean | number;
    duration?: number;
    ease?: string;
    delay?: number;
    threshold?: number;
    initialOpacity?: number;
    stagger?: number;
    staggerFrom?: string;
    trigger?: 'scroll' | 'mount';
    once?: boolean;
    exit?: boolean;
    scrub?: boolean | number;
    disappearAfter?: number;
    disappearDuration?: number;
    disappearEase?: string;
    onStart?: () => void;
    onComplete?: () => void;
    onDisappearanceComplete?: () => void;
    className?: string;
    style?: CSSProperties;
    [key: string]: unknown;
  }): ReactNode;
}

declare module '@/components/react-bits/AnimatedContent' {
  export default function AnimatedContent(props: {
    children?: ReactNode;
    container?: string | HTMLElement | null;
    distance?: number;
    direction?: 'vertical' | 'horizontal';
    reverse?: boolean;
    duration?: number;
    ease?: string;
    initialOpacity?: number;
    animateOpacity?: boolean;
    scale?: number;
    blur?: number;
    rotate?: number;
    tilt?: number;
    wipe?: string;
    threshold?: number;
    delay?: number;
    stagger?: number;
    staggerFrom?: string;
    trigger?: 'scroll' | 'mount';
    once?: boolean;
    scrub?: boolean | number;
    disappearAfter?: number;
    disappearDuration?: number;
    disappearEase?: string;
    onStart?: () => void;
    onComplete?: () => void;
    onDisappearanceComplete?: () => void;
    className?: string;
    style?: CSSProperties;
    [key: string]: unknown;
  }): ReactNode;
}

declare module '@/components/react-bits/ClickSpark' {
  export default function ClickSpark(props: {
    children?: ReactNode;
    sparkColor?: string | string[];
    sparkSize?: number;
    sparkRadius?: number;
    sparkCount?: number;
    sparkWidth?: number;
    duration?: number;
    easing?: string;
    extraScale?: number;
    shape?: string;
    randomness?: number;
    gravity?: number;
    spread?: number;
    direction?: number;
    glow?: number;
    ring?: boolean;
    disabled?: boolean;
    className?: string;
    style?: CSSProperties;
    ref?: Ref<{ spark: (x?: number, y?: number) => void }>;
    [key: string]: unknown;
  }): ReactNode;
}
