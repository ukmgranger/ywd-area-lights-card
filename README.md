# YWD Area Lights Card

A custom Home Assistant Lovelace card that automatically displays lights and switches for a selected area, with per-entity customisation, brightness sliders for lights, drag-and-drop ordering, and a built-in GUI editor.

This card was built primarily for my own setup and my own preferences. I am sharing it in case it is useful to someone else, but it is not intended to be a polished, fully supported public project.

There is no formal support, no promised roadmap, and no guarantee that it will work perfectly in every Home Assistant setup. I may update it when it suits my own needs, but that is about the extent of it.
<img width="547" height="545" alt="area-lights-card" src="https://github.com/user-attachments/assets/9779974e-7a50-41a1-92c3-077be28fd856" />
## Features

- Automatically finds lights and switches in a selected Home Assistant area
- Supports both entity-level area assignment and device-level area assignment
- Optional multi-column layout
- Per-entity name overrides
- Per-entity icon overrides
- Per-entity hide/show controls
- Drag-and-drop entity ordering in the editor
- Brightness sliders for light entities
- Optional use of the actual light colour for active icons
- Theme-aware styling
- Built-in Home Assistant GUI editor
- Tap to toggle
- Long press on the entity info area for more-info

## Installation

Manual installation only.

1. Copy the card JavaScript file into your Home Assistant `www` folder.

   Example:
   ```text
   /config/www/ywd-area-lights-card.js
   ```

2. Go to **Settings → Dashboards → Resources**

3. Add a new resource:

   - **URL:** `/local/ywd-area-lights-card.js`
   - **Type:** `JavaScript Module`

4. Refresh Home Assistant.

## Basic Example

```yaml
type: custom:ywd-area-lights-card
area: kitchen
columns: 1
```

## Example With Styling

```yaml
type: custom:ywd-area-lights-card
area: kitchen
columns: 2
tile_color: var(--ha-card-background)
icon_color_on: var(--primary-color)
icon_color_off: rgba(255,255,255,0.4)
border_radius: 28px
```

## Configuration

### Main options

| Name | Type | Default | Description |
|---|---|---|---|
| `area` | string | `""` | Home Assistant area to display entities from |
| `columns` | number | `1` | Number of columns in the grid |
| `domains` | list | `['light', 'switch']` | Domains to include |
| `entity_overrides` | object | `{}` | Per-entity custom settings |
| `entity_order` | list | `[]` | Custom entity order |
| `tile_color` | string | `var(--card-background-color, #1c1c1c)` | Card background colour |
| `icon_color_on` | string | `var(--primary-color)` | Icon colour when entity is on |
| `icon_color_off` | string | `rgba(255,255,255,0.4)` | Icon colour when entity is off |
| `show_state` | boolean | `true` | Reserved for future use |
| `border_radius` | string | `28px` | Border radius for each tile |

## Entity Overrides

You can customise individual entities using `entity_overrides`.

### Supported override options

| Name | Type | Description |
|---|---|---|
| `name` | string | Custom display name |
| `icon` | string | Custom icon |
| `hidden` | boolean | Hide the entity from the card |
| `use_light_color` | boolean | For lights, use the light's actual RGB colour when on |

### Example

```yaml
type: custom:ywd-area-lights-card
area: living_room
columns: 2
entity_order:
  - light.main_lamp
  - light.corner_lamp
  - switch.fireplace
entity_overrides:
  light.main_lamp:
    name: Main Lamp
    icon: mdi:floor-lamp
  light.corner_lamp:
    use_light_color: true
  switch.fireplace:
    name: Fire
    icon: mdi:fireplace
  switch.unused_socket:
    hidden: true
```

## Behaviour

- The card automatically discovers supported entities in the selected area
- If an entity has its own area, it will be included
- If an entity belongs to a device assigned to the area, it will also be included
- Tapping the main entity info section toggles the entity
- Long pressing the main entity info section opens more-info
- For lights, the brightness slider appears only when the light is on
- Brightness changes are sent using `light.turn_on` with `brightness_pct`

## Notes

- This card is intended for areas containing `light` and `switch` entities by default
- The `domains` option exists in the code, but the editor is currently focused on lights and switches
- The `show_state` option exists in the config but is not currently used in the rendered output
- Colour fields accept normal CSS colour values, including theme variables such as `var(--primary-color)`
- The editor includes drag-and-drop reordering and per-entity customisation controls



## Example Dashboard Snippet

```yaml
type: grid
columns: 2
square: false
cards:
  - type: custom:ywd-area-lights-card
    area: kitchen
    columns: 1

  - type: custom:ywd-area-lights-card
    area: living_room
    columns: 2
    border_radius: 24px
    icon_color_on: var(--primary-color)
```

## Disclaimer

This card was built for my own personal use, based on how I wanted my dashboard to look and behave.

You are welcome to use it and adapt it, but there is no real support provided. I may update it for my own needs, but I am not maintaining it as a fully supported public project.

## License

Use, modify, and share at your own discretion.
