import React, { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { Icon } from 'src/types';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { getIsoProjectionCss } from 'src/utils';
import { useResizeObserver } from 'src/hooks/useResizeObserver';

interface Props {
  icon: Icon;
  scale?: number;
}

export const NonIsometricIcon = ({ icon, scale = 1 }: Props) => {
  const ref = useRef();
  const { size, observe, disconnect } = useResizeObserver();

  useEffect(() => {
    if (!ref.current) return;

    observe(ref.current);

    return disconnect;
  }, [observe, disconnect]);

  return (
    <Box
      sx={{
        position: 'absolute',
        // Same anchoring technique as IsometricIcon: position the box from the
        // measured size so the icon's base sits on the tile point and a larger
        // icon grows upward instead of drifting off the tile. The isometric
        // projection is applied around that same base point.
        top: -size.height,
        left: -size.width / 2,
        transformOrigin: 'center bottom',
        transform: getIsoProjectionCss(),
        pointerEvents: 'none'
      }}
    >
      <Box
        ref={ref}
        component="img"
        draggable={false}
        src={icon.url}
        alt={`icon-${icon.id}`}
        sx={{ display: 'block', width: PROJECTED_TILE_SIZE.width * 0.7 * scale }}
      />
    </Box>
  );
};
