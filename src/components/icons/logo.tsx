import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M16 31C24.2843 31 31 24.2843 31 16C31 7.71573 24.2843 1 16 1C7.71573 1 1 7.71573 1 16C1 24.2843 7.71573 31 16 31Z"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 13C12.0711 11.1293 15.663 11.103 17.766 13.0132L21.987 16.8206C24.0901 18.7308 23.9161 22.083 21.6569 23.6933C19.3976 25.3036 16.035 24.8978 14 23L10 19.4142C7.92893 17.5435 7.95451 14.284 9.98701 12.3067C12.0195 10.3294 15.3431 10.3688 17.3259 12.3516"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
