import Animated from 'react-native-reanimated';
import { type, space } from '@/constants/tokens';

export function HelloWave() {
  return (
    <Animated.Text
      style={{
        ...type.title,
        marginTop: -space.sm,
        animationName: {
          '50%': { transform: [{ rotate: '25deg' }] },
        },
        animationIterationCount: 4,
        animationDuration: '300ms',
      }}>
      👋
    </Animated.Text>
  );
}
