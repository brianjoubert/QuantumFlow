import React from 'react';
import { Box } from '@mui/material';
import { Icon } from 'src/types';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { getIsoProjectionCss } from 'src/utils';

interface Props {
  icon: Icon;
  scale?: number;
}

export const NonIsometricIcon = ({ icon, scale = 1 }: Props) => {
  return (
    <Box sx={{ pointerEvents: 'none' }}>
      <Box
        sx={{
          position: 'absolute',
          left: -PROJECTED_TILE_SIZE.width / 2,
          top: -PROJECTED_TILE_SIZE.height / 2,
          transformOrigin: 'top left',
          transform: getIsoProjectionCss()
        }}
      >
        <Box
          component="img"
          draggable={false}
          src={icon.url}
          alt={`icon-${icon.id}`}
          sx={{
            display: 'block',
            width: PROJECTED_TILE_SIZE.width * 0.7,
            // The icon is projected flat onto the tile's ground plane, so scale
            // it symmetrically around its centre. It grows outward on the tile
            // (staying at ground level / z=0) instead of drifting upward.
            transform: `scale(${scale})`,
            transformOrigin: 'center center'
          }}
        />
      </Box>
    </Box>
  );
};
