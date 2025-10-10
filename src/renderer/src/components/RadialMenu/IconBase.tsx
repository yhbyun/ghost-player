import React from 'react'

interface IconBaseProps {
  children: React.ReactNode
  viewBox?: string
  width?: string | number
  height?: string | number
  iconName?: string
}

const IconBase: React.FC<IconBaseProps> = ({
  children,
  viewBox = '0 0 24 24',
  width = '24',
  height = '24',
  iconName
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={viewBox}
      aria-labelledby={iconName}
      role="presentation"
    >
      {children}
    </svg>
  )
}

export default IconBase
