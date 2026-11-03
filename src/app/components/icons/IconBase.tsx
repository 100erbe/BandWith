import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  className?: string;
}

export type LucideProps = IconProps;

export type IconComponent = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;

export type LucideIcon = IconComponent;

export const createIcon = (
  displayName: string,
  renderContent: (strokeWidth: number | string) => React.ReactNode,
  viewBox = '0 0 24 24',
  defaultStrokeWidth: number | string = 2
): IconComponent => {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(
    (
      {
        size = 24,
        color = 'currentColor',
        strokeWidth = defaultStrokeWidth,
        absoluteStrokeWidth = false,
        className = '',
        children,
        ...props
      },
      ref
    ) => {
      const computedStrokeWidth =
        absoluteStrokeWidth && Number(size) > 0
          ? (Number(strokeWidth) * 24) / Number(size)
          : strokeWidth;

      return (
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox={viewBox}
          fill="none"
          stroke={color}
          strokeWidth={computedStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden={props['aria-label'] ? undefined : true}
          className={className}
          {...props}
        >
          {renderContent(computedStrokeWidth)}
          {children}
        </svg>
      );
    }
  );

  Icon.displayName = displayName;
  return Icon;
};
