# Radar Chart Component Documentation

## Overview
The RadarChart component is a sophisticated SVG-based visualization that compares two business decisions across 6 strategic dimensions. It's used in the "Análise Completa" (Complete Analysis) section of the Inverted Decisions Simulator to provide a visual comparison between the original decision and its inverted alternative.

## Component Location
**File:** `components/RadarChart.tsx`

## How It Works

### 1. Data Structure
The component expects two datasets with identical structure:

```typescript
interface RadarChartProps {
  realData: {
    financial: number;        // 0-10 scale
    operational: number;      // 0-10 scale
    reputation: number;       // 0-10 scale
    risk: number;            // 0-10 scale
    innovation: number;      // 0-10 scale
    sustainability: number;  // 0-10 scale
  };
  invertedData: {
    financial: number;
    operational: number;
    reputation: number;
    risk: number;
    innovation: number;
    sustainability: number;
  };
}
```

### 2. Core Mathematical Concepts

#### Coordinate System
- **Canvas Size:** 500×500 pixels
- **Center Point:** (250, 250)
- **Max Radius:** 180 pixels
- **Value Mapping:** Each 0-10 value maps to 0-180 pixel radius

#### Angle Calculation
Each of the 6 metrics is positioned at equal angles around the circle:
```
Angle = (2π × index) / 6 - π/2
```

This creates 60° intervals starting from the top (north position).

#### Point Positioning
For each data point:
```
x = center + (value/10) × maxRadius × cos(angle)
y = center + (value/10) × maxRadius × sin(angle)
```

### 3. Component Architecture

#### Main Functions

**1. `getPoint(value, index)`**
Calculates Cartesian coordinates for a data point:
```typescript
const getPoint = (value: number, index: number) => {
  const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
  const radius = (value / 10) * maxRadius;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle)
  };
};
```

**2. `createPath(data)`**
Generates SVG path string for polygon:
```typescript
const createPath = (data: any) => {
  const points = metrics.map((metric, index) =>
    getPoint(data[metric.key as keyof typeof data], index)
  );
  return points.map((point, i) =>
    `${i === 0 ? 'M' : 'L'} ${point.x},${point.y}`
  ).join(' ') + ' Z';
};
```

### 4. Visual Components

#### Background Grid
- **Concentric Circles:** 5 levels representing 2, 4, 6, 8, 10 scale values
- **Radial Lines:** 6 axes connecting center to each metric position
- **Style:** Subtle white lines with 10% opacity

#### Data Visualization
- **Polygons:** Filled areas with 20% opacity
- **Borders:** 3px solid lines with glow effects
- **Data Points:** 6px circles at each vertex
- **Hover Effects:** Enhanced visibility on mouseover

#### Color Scheme
- **Real Decision:** Blue (#3B82F6)
- **Inverted Decision:** Purple (#A855F7)
- **Glow Effects:** Custom SVG filters for visual enhancement

### 5. Labels and Annotations

Each axis displays:
1. **Emoji Icon** representing the dimension
2. **Metric Name** in Portuguese
3. **Real Value** in blue (formatted to 1 decimal place)
4. **Inverted Value** in purple (formatted to 1 decimal place)

Positioned at extended radius (maxRadius + 50 pixels) to avoid overlap.

### 6. Interactive Features

#### Hover Effects
- Polygon fill opacity increases from 20% to 30%
- Data point circles expand from 6px to 8px radius
- Smooth transitions with 300ms duration

#### SVG Filters
Custom glow effects using Gaussian blur:
```xml
<filter id="glow-blue">
  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
  <feMerge>
    <feMergeNode in="coloredBlur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>
```

### 7. Complete Implementation

```tsx
import React from 'react';

interface RadarChartProps {
  realData: {
    financial: number;
    operational: number;
    reputation: number;
    risk: number;
    innovation: number;
    sustainability: number;
  };
  invertedData: {
    financial: number;
    operational: number;
    reputation: number;
    risk: number;
    innovation: number;
    sustainability: number;
  };
}

const RadarChart: React.FC<RadarChartProps> = ({ realData, invertedData }) => {
  const metrics = [
    { key: 'financial', label: 'Impacto Financeiro', icon: '💰' },
    { key: 'operational', label: 'Eficiência Operacional', icon: '⚙️' },
    { key: 'reputation', label: 'Reputação', icon: '⭐' },
    { key: 'risk', label: 'Gestão de Risco', icon: '🛡️' },
    { key: 'innovation', label: 'Inovação', icon: '💡' },
    { key: 'sustainability', label: 'Sustentabilidade', icon: '🌱' }
  ];

  const size = 500;
  const center = size / 2;
  const maxRadius = 180;
  const levels = 5;

  // Calculate polygon points for data
  const getPoint = (value: number, index: number) => {
    const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
    const radius = (value / 10) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    };
  };

  // Create path for data
  const createPath = (data: any) => {
    const points = metrics.map((metric, index) =>
      getPoint(data[metric.key as keyof typeof data], index)
    );
    return points.map((point, i) =>
      `${i === 0 ? 'M' : 'L'} ${point.x},${point.y}`
    ).join(' ') + ' Z';
  };

  // Create grid levels (concentric circles)
  const gridLevels = Array.from({ length: levels }, (_, i) => {
    const radius = maxRadius * ((i + 1) / levels);
    return (
      <circle
        key={i}
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth="1"
      />
    );
  });

  // Create radial lines (axes)
  const radialLines = metrics.map((_, index) => {
    const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
    const x = center + maxRadius * Math.cos(angle);
    const y = center + maxRadius * Math.sin(angle);
    return (
      <line
        key={index}
        x1={center}
        y1={center}
        x2={x}
        y2={y}
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth="1"
      />
    );
  });

  // Labels for each axis
  const labels = metrics.map((metric, index) => {
    const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
    const labelRadius = maxRadius + 50;
    const x = center + labelRadius * Math.cos(angle);
    const y = center + labelRadius * Math.sin(angle);

    const realValue = realData[metric.key as keyof typeof realData];
    const invertedValue = invertedData[metric.key as keyof typeof invertedData];

    return (
      <g key={index}>
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="14"
          fontWeight="600"
          className="select-none"
        >
          <tspan x={x} dy="-10">{metric.icon}</tspan>
          <tspan x={x} dy="20">{metric.label}</tspan>
          <tspan x={x} dy="18" fontSize="12" fill="rgba(59, 130, 246, 1)" fontWeight="700">
            Real: {realValue.toFixed(1)}
          </tspan>
          <tspan x={x} dy="16" fontSize="12" fill="rgba(168, 85, 247, 1)" fontWeight="700">
            Inv: {invertedValue.toFixed(1)}
          </tspan>
        </text>
      </g>
    );
  });

  const realPath = createPath(realData);
  const invertedPath = createPath(invertedData);

  return (
    <div className="w-full flex justify-center items-center p-8">
      <div className="relative">
        <svg
          width={size + 100}
          height={size + 100}
          viewBox={`0 0 ${size + 100} ${size + 100}`}
          className="drop-shadow-2xl"
        >
          <defs>
            <filter id="glow-blue">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="glow-purple">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <g transform="translate(50, 50)">
            {/* Background grid */}
            {gridLevels}
            {radialLines}

            {/* Real decision polygon */}
            <path
              d={realPath}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="rgba(59, 130, 246, 1)"
              strokeWidth="3"
              filter="url(#glow-blue)"
              className="transition-all duration-300 hover:fill-opacity-30"
            />

            {/* Real decision points */}
            {metrics.map((metric, index) => {
              const point = getPoint(realData[metric.key as keyof typeof realData], index);
              return (
                <circle
                  key={`real-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="6"
                  fill="rgba(59, 130, 246, 1)"
                  stroke="white"
                  strokeWidth="2"
                  filter="url(#glow-blue)"
                  className="transition-all duration-300 hover:r-8"
                />
              );
            })}

            {/* Inverted decision polygon */}
            <path
              d={invertedPath}
              fill="rgba(168, 85, 247, 0.2)"
              stroke="rgba(168, 85, 247, 1)"
              strokeWidth="3"
              filter="url(#glow-purple)"
              className="transition-all duration-300 hover:fill-opacity-30"
            />

            {/* Inverted decision points */}
            {metrics.map((metric, index) => {
              const point = getPoint(invertedData[metric.key as keyof typeof invertedData], index);
              return (
                <circle
                  key={`inverted-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="6"
                  fill="rgba(168, 85, 247, 1)"
                  stroke="white"
                  strokeWidth="2"
                  filter="url(#glow-purple)"
                  className="transition-all duration-300 hover:r-8"
                />
              );
            })}

            {/* Labels */}
            {labels}
          </g>
        </svg>

        {/* Legend */}
        <div className="flex justify-center gap-8 mt-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
            <span className="text-white font-semibold text-lg">Decisão Real</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-500 rounded-full border-2 border-white shadow-lg"></div>
            <span className="text-white font-semibold text-lg">Decisão Invertida</span>
          </div>
        </div>

        {/* Explanation note */}
        <div className="mt-6 text-center">
          <p className="text-gray-300 text-sm">
            Escala de 0 a 10 — Quanto maior o valor, melhor o desempenho na dimensão
          </p>
        </div>
      </div>
    </div>
  );
};

export default RadarChart;
```

## Usage Example

```tsx
// In ResultsPage.tsx
<RadarChart
  realData={result.radarMetrics.real}
  invertedData={result.radarMetrics.inverted}
/>
```

## Key Features Summary

✅ **6-Dimensional Comparison** - Financial, Operational, Reputation, Risk, Innovation, Sustainability  
✅ **Interactive Visualization** - Hover effects and smooth transitions  
✅ **Clear Color Coding** - Blue for real decision, purple for inverted decision  
✅ **Numerical Precision** - Values displayed with 1 decimal place  
✅ **Responsive Design** - Centered layout with proper spacing  
✅ **Accessibility** - Clear labels and legend for interpretation  
✅ **Performance Optimized** - Pure SVG rendering with CSS transitions  

## Mathematical Foundation

The radar chart uses **polar coordinate transformation** to map linear values (0-10) to circular positions, then converts to Cartesian coordinates for SVG rendering. This creates an intuitive visual representation where larger values extend further from the center, making performance differences immediately apparent.