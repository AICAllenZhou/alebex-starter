import type { ComponentType, CSSProperties, ReactNode } from 'react';
import RawAnimatedContent from '@/components/react-bits/AnimatedContent';
import RawClickSpark from '@/components/react-bits/ClickSpark';
import RawFadeContent from '@/components/react-bits/FadeContent';

// The copied React Bits sources are JavaScript. These wrappers pin the props
// the call page actually uses so typecheck does not depend on inferred JS types.

export const FadeContent = RawFadeContent as ComponentType<{
  children?: ReactNode;
  trigger?: 'scroll' | 'mount';
  duration?: number;
  blur?: boolean | number;
  className?: string;
  style?: CSSProperties;
}>;

export const AnimatedContent = RawAnimatedContent as ComponentType<{
  children?: ReactNode;
  trigger?: 'scroll' | 'mount';
  distance?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}>;

export const ClickSpark = RawClickSpark as ComponentType<{
  children?: ReactNode;
  sparkColor?: string;
  sparkCount?: number;
  sparkRadius?: number;
  sparkSize?: number;
  duration?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}>;
