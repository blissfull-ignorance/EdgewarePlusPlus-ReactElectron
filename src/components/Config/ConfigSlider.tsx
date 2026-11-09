import { useEffect, useState } from "react";
import { Group, NumberInput, Slider } from "@mantine/core";
import { ConfigFieldLabel } from "./ConfigFieldLabel";

interface ConfigSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  description?: string;
  disabled?: boolean;
}

export function ConfigSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  description,
  disabled,
}: ConfigSliderProps) {
  const [manualValue, setManualValue] = useState<string>(value.toString());

  useEffect(() => {
    setManualValue(value.toString());
  }, [value]);

  const handleSliderChange = (val: number) => {
    onChange(val);
    setManualValue(val.toString());
  };

  const handleNumberChange = (val: string | number) => {
    const num = typeof val === "number" ? val : Number(val);
    if (val === "" || isNaN(num)) return;
    const clamped = Math.min(max, Math.max(min, num));
    onChange(clamped);
    setManualValue(clamped.toString());
  };

  return (
    <Group gap="md" align="flex-start" style={{ minWidth: 0 }}>
      <div style={{ flex: "0 0 150px", minWidth: 120, maxWidth: 190 }}>
        <ConfigFieldLabel label={label} description={description} />
      </div>
      <Slider
        value={value}
        onChange={handleSliderChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        style={{ flex: 1, minWidth: 80 }}
      />
      <NumberInput
        value={manualValue}
        onChange={handleNumberChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        w={84}
      />
    </Group>
  );
}
