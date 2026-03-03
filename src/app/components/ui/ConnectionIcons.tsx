import React from 'react';

interface IconProps {
  className?: string;
}

export const PlugsConnectedIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M14.106 7.76854L7.76881 14.1058C6.74369 15.1309 6.74369 16.7929 7.76881 17.8181L10.1818 20.2311C11.2069 21.2562 12.869 21.2562 13.8941 20.2311L20.2314 13.8938C21.2565 12.8687 21.2565 11.2067 20.2314 10.1815L17.8183 7.76854C16.7932 6.74341 15.1312 6.74341 14.106 7.76854Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.625 9.625L18.375 18.375" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M25.3752 2.625L19.0248 8.97531" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.97531 19.0244L2.625 25.3747" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10.5 3.5L11.375 5.6875" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.5 10.5L5.6875 11.375" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22.3125 16.625L24.5 17.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.625 22.3125L17.5 24.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ChecksIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M3 24.4294L10.2 31.5L27 15" stroke="#17C764" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M23.6177 27L28.2002 31.5L45.0002 15" stroke="#17C764" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const PlugsDisconnectedIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M15.75 15.75L13.125 18.375" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12.25 12.25L9.625 14.875" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 12.25L15.75 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6.35031 21.6494L2.625 25.3747" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.4375 19.6875L11.2656 22.8594C10.7734 23.3516 10.1057 23.6282 9.40955 23.6282C8.71339 23.6282 8.04574 23.3516 7.55346 22.8594L5.14065 20.4433C4.64941 19.9511 4.3735 19.2842 4.3735 18.5888C4.3735 17.8935 4.64941 17.2265 5.14065 16.7344L8.31252 13.5625" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12.25 7L21 15.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21.6496 6.35031L25.3749 2.625" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19.6875 14.4373L22.8594 11.2654C23.3516 10.7732 23.6282 10.1055 23.6282 9.40934C23.6282 8.71318 23.3516 8.04553 22.8594 7.55325L20.4433 5.14044C19.9511 4.64919 19.2842 4.37329 18.5888 4.37329C17.8935 4.37329 17.2265 4.64919 16.7344 5.14044L13.5625 8.31231" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
