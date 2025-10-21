declare module 'react-native-vector-icons/Feather' {
  import { ComponentType } from 'react';
  import { TextStyle, ViewStyle, ImageStyle } from 'react-native';

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle | ImageStyle;
  }

  const Feather: ComponentType<IconProps>;
  export default Feather;
}
