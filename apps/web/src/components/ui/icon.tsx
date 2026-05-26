import type { Component } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import type { LucideProps } from "lucide-solid";

export type IconProps = {
	icon: Component<LucideProps>;
	size?: number;
	strokeWidth?: number;
} & Omit<LucideProps, "size" | "strokeWidth">;

const Icon: Component<IconProps> = (raw_props) => {
	const props = mergeProps({ size: 16, strokeWidth: 2 }, raw_props);
	const [local, rest] = splitProps(props, ["icon", "size", "strokeWidth"]);

	return (
		<local.icon size={local.size} strokeWidth={local.strokeWidth} {...rest} />
	);
};

export { Icon };
