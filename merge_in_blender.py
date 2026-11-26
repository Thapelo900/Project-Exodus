import bpy
from pathlib import Path
root=Path(bpy.data.filepath).parent if bpy.data.filepath else Path.cwd()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'OutPost_ORIGINAL.glb'))
bpy.ops.import_scene.gltf(filepath=str(root/'Outpost_Collapse_Details.glb'))
bpy.ops.export_scene.gltf(filepath=str(root/'OutPost_Redesigned.glb'),export_format='GLB',export_apply=False)
print('Exported OutPost_Redesigned.glb')
