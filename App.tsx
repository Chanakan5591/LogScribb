import { StatusBar } from 'expo-status-bar';
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { Dimensions, StyleSheet, Text, TouchableOpacity, useAnimatedValue, View } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { Canvas, Circle, Group, Paint, Path, scale, Turbulence, useDerivedValueOnJS, usePathValue, usePointBuffer, vec } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

// --- Constants for Bottom Pad ---
const BOTTOM_PAD_HEIGHT = 150;
const ZOOM_FACTOR = 2;
const MARKER_RADIUS = 5;

type PathType = { x: number; y: number }[];

export default function App() {
  const [paths, setPaths] = useState<PathType[]>([]);
  const currentPath = useSharedValue<PathType>([]);
  const [drawingMode, setDrawingMode] = useState<'bottomPad' | 'direct'>('bottomPad');
  const markerScaleFactor = 1.2;

  const markerPositionX = useSharedValue(windowWidth / 2);
  const markerPositionY = useSharedValue(windowHeight / 4);

  const initialTouchX = useSharedValue(0);
  const initialTouchY = useSharedValue(0);
  const initialMarkerX = useSharedValue(0);
  const initialMarkerY = useSharedValue(0);

  const [bottomPadText, setBottomPadText] = useState('');
  const [recognizedChar, setRecognizedChars] = useState<string[]>([]);

  const toggleDrawingMode = () => {
    setDrawingMode((prevMode) => (prevMode === 'direct' ? 'bottomPad' : 'direct'));
  };

  const handleMarkerPanGesture = Gesture.Pan()
    .onStart((e) => {
      console.log("Marker Pan Gesture Started");
      initialTouchX.value = e.absoluteX;
      initialTouchY.value = e.absoluteY;
      initialMarkerX.value = markerPositionX.value;
      initialMarkerY.value = markerPositionY.value;
    })
    .onUpdate((e) => {
      const diffX = e.absoluteX - initialTouchX.value;
      const diffY = e.absoluteY - initialTouchY.value;

      markerPositionX.value = initialMarkerX.value + diffX;
      markerPositionY.value = initialMarkerY.value + diffY;
      console.log(`Marker Pan Updated: (${markerPositionX.value}, ${markerPositionY.value})`);
    })
    .onFinalize(() => {
      console.log("Marker Pan Gesture Finalized");
    });

  const setNewPath = (newPath: PathType) => {
    setPaths((prevPaths) => [...prevPaths, newPath]);
  };

  const handleDrawPanGesture = Gesture.Pan()
    .onStart((e) => {
      console.log("Draw Pan Gesture Started");
      initialTouchX.value = e.absoluteX;
      initialTouchY.value = e.absoluteY;
      initialMarkerX.value = markerPositionX.value;
      initialMarkerY.value = markerPositionY.value;
      // Initialize the path with the current marker position
      currentPath.set([{ x: markerPositionX.value, y: markerPositionY.value }]);
      console.log("Current Path Initialized:", currentPath.get());
    })
    .onUpdate((e) => {
      const diffX = e.absoluteX - initialTouchX.value;
      const diffY = e.absoluteY - initialTouchY.value;

      markerPositionX.value = initialMarkerX.value + diffX;
      markerPositionY.value = initialMarkerY.value + diffY;

      // Add the new point to the current path
      const newPoint = { x: markerPositionX.value, y: markerPositionY.value };
      currentPath.set([...currentPath.get(), newPoint]);
      console.log("Current Path Updated:", currentPath.get());
    })
    .onFinalize(() => {
      console.log("Draw Pan Gesture Finalized");
      if (Array.isArray(currentPath.get()) && currentPath.get().length > 0) {
        runOnJS(setPaths)([...(paths || []), currentPath.get()]);
      } else {
        console.log("No path to add.");
      }
      // Clear currentPath
      currentPath.set([]);
      console.log("Current Path Cleared:", currentPath.get());
    });

  const markerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withSpring(markerPositionX.value) },
      { translateY: withSpring(markerPositionY.value) },
    ],
  }));

  console.log("Current Paths Length:", paths.length);

  return (
    <GluestackUIProvider mode="light">
      <GestureHandlerRootView style={styles.container}>
        <TouchableOpacity onPress={toggleDrawingMode} style={styles.toggleButton}>
          <Text>{drawingMode === 'direct' ? 'Direct Mode' : 'Pad Mode'}</Text>
        </TouchableOpacity>
        <GestureDetector gesture={handleMarkerPanGesture}>
          <Canvas style={styles.canvas}>
            {Array.isArray(paths) && paths.map((path, index) => {
              const pathString = path.length > 0
                ? `M${path[0].x},${path[0].y} ` + path.slice(1).map((p) => `L${p.x},${p.y}`).join(' ')
                : '';
              return (
                pathString !== '' && <Path key={index} path={pathString} strokeWidth={4} color="black" />
              );
            })}
            {currentPath.value.length > 0 && (
              <Path
                path={
                  `M${currentPath.value[0].x},${currentPath.value[0].y} ` +
                  currentPath.value.slice(1).map(p => `L${p.x},${p.y}`).join(' ')
                }
                strokeWidth={4}
                color="black"
              />
            )}

            {drawingMode === 'bottomPad' && (
              <Circle cx={markerPositionX} cy={markerPositionY} r={MARKER_RADIUS} color='blue' />
            )}
          </Canvas>
        </GestureDetector>

        {drawingMode === 'bottomPad' && (
          <View style={styles.bottomPad}>
            <GestureDetector gesture={handleDrawPanGesture}>
              <Canvas style={styles.bottomPadCanvas}>
                <Group transform={[{ scale: ZOOM_FACTOR }]}>
                  {Array.isArray(paths) && paths.map((path, index) => {
                    const pathString = path.length > 0
                      ? `M${path[0].x},${path[0].y} ` + path.slice(1).map((p) => `L${p.x},${p.y}`).join(' ')
                      : '';
                    return (
                      pathString !== '' && <Path key={index} path={pathString} strokeWidth={4} color="black" />
                    )
                  })}
                </Group>
              </Canvas>
            </GestureDetector>
          </View>
        )}
      </GestureHandlerRootView>
    </GluestackUIProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  bottomPad: {
    height: BOTTOM_PAD_HEIGHT,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderColor: 'gray',
  },
  bottomPadCanvas: {
    flex: 1,
  },
  toggleButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 5,
    zIndex: 10,
  },
  toggleButtonText: {
    color: 'white',
  },
  textDisplay: {
    position: 'absolute',
    bottom: BOTTOM_PAD_HEIGHT + 10, // Adjust as needed
    left: 10,
    backgroundColor: 'white',
    padding: 5,
    borderRadius: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
});
