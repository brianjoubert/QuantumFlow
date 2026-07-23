import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { Button, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Icon as IconI } from 'src/types';

const SIZE = 50;

interface Props {
  icon: IconI;
  onClick?: () => void;
  onMouseDown?: () => void;
  onDoubleClick?: () => void;
  onDelete?: () => void;
}

export const Icon = ({
  icon,
  onClick,
  onMouseDown,
  onDoubleClick,
  onDelete
}: Props) => {
  // Only imported/custom icons can be removed (built-in packs reload anyway).
  const canDelete = Boolean(onDelete) && icon.collection === 'imported';

  return (
    <Box sx={{ position: 'relative' }}>
      {canDelete && (
        <IconButton
          aria-label={`Delete ${icon.name}`}
          size="small"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          sx={{
            position: 'absolute',
            top: 2,
            right: 2,
            zIndex: 2,
            padding: '2px',
            backgroundColor: 'background.paper',
            boxShadow: 1,
            '&:hover': {
              backgroundColor: 'error.main',
              color: 'error.contrastText'
            }
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
      <Button
        variant="text"
        onClick={onClick}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        sx={{
          userSelect: 'none'
        }}
      >
        <Stack
          sx={{ overflow: 'hidden', justifyContent: 'flex-start', width: SIZE }}
          spacing={1}
        >
          <Box sx={{ width: SIZE, height: SIZE, overflow: 'hidden' }}>
            <Box
              component="img"
              draggable={false}
              src={icon.url}
              alt={`Icon ${icon.name}`}
              sx={{ width: SIZE, height: SIZE }}
            />
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            textOverflow="ellipsis"
          >
            {icon.name}
          </Typography>
        </Stack>
      </Button>
    </Box>
  );
};
