import * as BABYLON from '@babylonjs/core';

export type PlayerSkinId = 'blocky' | 'capsule' | 'robot' | 'kogama' | 'boy' | 'girl';

export interface PlayerSkinColors {
  primary: BABYLON.Color3; // main body/head color
  secondary?: BABYLON.Color3; // accents (arms/legs)
  tertiary?: BABYLON.Color3; // accessories/face accents
}

/**
 * High-level, engine-agnostic configuration for modular avatar (KoGaMa-like)
 */
export interface PlayerSkinConfig {
  headType?: 'cube' | 'rounded' | 'capsule';
  bodyType?: 'slim' | 'normal' | 'bulk';
  limbStyle?: 'block' | 'cylinder';
  accessoryHat?: 'none' | 'cap' | 'topHat';
  accessoryBack?: 'none' | 'backpack' | 'cape';
  face?: {
    eyes?: 'dot' | 'cartoon' | 'robot';
    mouth?: 'smile' | 'neutral' | 'none';
  };
}

export interface PlayerSkinInstance {
  root: BABYLON.Mesh;
  height: number;
  anchorYOffset: number; // feet alignment offset (half height typically)
}

export function createSkinMesh(
  scene: BABYLON.Scene,
  skinId: PlayerSkinId = 'blocky',
  colors?: PlayerSkinColors,
  config?: PlayerSkinConfig
): PlayerSkinInstance {
  switch (skinId) {
    case 'boy': {
      const def: PlayerSkinConfig = { headType: 'cube', bodyType: 'normal', limbStyle: 'block', accessoryHat: 'none', accessoryBack: 'none', face: { eyes: 'dot', mouth: 'smile' } };
      const merged = { ...def, ...config, face: { ...def.face, ...(config?.face || {}) } };
      return createKogamaSkin(scene, colors, merged);
    }
    case 'girl': {
      const def: PlayerSkinConfig = { headType: 'rounded', bodyType: 'slim', limbStyle: 'cylinder', accessoryHat: 'none', accessoryBack: 'none', face: { eyes: 'cartoon', mouth: 'smile' } };
      const merged = { ...def, ...config, face: { ...def.face, ...(config?.face || {}) } };
      return createKogamaSkin(scene, colors, merged);
    }
    case 'capsule':
      return createCapsuleSkin(scene, colors);
    case 'robot':
      return createRobotSkin(scene, colors);
    case 'kogama':
      return createKogamaSkin(scene, colors, config);
    case 'blocky':
    default:
      return createBlockySkin(scene, colors);
  }
}

function createBlockySkin(scene: BABYLON.Scene, colors?: PlayerSkinColors): PlayerSkinInstance {
  const root = new BABYLON.Mesh('player_root_blocky', scene);
  root.isPickable = false;

  // Dimensions
  const bodyHeight = 1.2;
  const bodyWidth = 0.8;
  const headSize = 0.5;
  const legHeight = 0.5;
  const armHeight = 0.6;

  const material = new BABYLON.PBRMaterial('player_blocky_mat', scene);
  material.metallic = 0.0;
  material.roughness = 0.7;
  material.albedoColor = colors?.primary ?? new BABYLON.Color3(0.2, 0.6, 0.9);

  // Body
  const body = BABYLON.MeshBuilder.CreateBox('player_blocky_body', { width: bodyWidth, height: bodyHeight, depth: 0.45 }, scene);
  body.parent = root;
  body.position.y = legHeight + bodyHeight / 2;
  body.material = material;
  body.isPickable = false;

  // Head
  const head = BABYLON.MeshBuilder.CreateBox('player_blocky_head', { size: headSize }, scene);
  head.parent = root;
  head.position.y = legHeight + bodyHeight + headSize * 0.6;
  head.material = material;
  head.isPickable = false;

  // Legs
  const legMat = new BABYLON.PBRMaterial('player_blocky_leg_mat', scene);
  legMat.metallic = 0.0;
  legMat.roughness = 0.7;
  legMat.albedoColor = colors?.secondary ?? new BABYLON.Color3(0.15, 0.4, 0.7);

  const legL = BABYLON.MeshBuilder.CreateBox('player_blocky_leg_l', { width: 0.25, height: legHeight, depth: 0.25 }, scene);
  legL.parent = root;
  legL.position.y = legHeight / 2;
  legL.position.x = -0.2;
  legL.material = legMat;
  legL.isPickable = false;

  const legR = legL.clone('player_blocky_leg_r');
  legR.parent = root;
  legR.position.x = 0.2;

  // Arms
  const armMat = new BABYLON.PBRMaterial('player_blocky_arm_mat', scene);
  armMat.metallic = 0.0;
  armMat.roughness = 0.7;
  armMat.albedoColor = colors?.secondary ?? new BABYLON.Color3(0.25, 0.7, 1.0);

  const armL = BABYLON.MeshBuilder.CreateBox('player_blocky_arm_l', { width: 0.22, height: armHeight, depth: 0.22 }, scene);
  armL.parent = root;
  armL.position.y = legHeight + bodyHeight * 0.6;
  armL.position.x = -(bodyWidth / 2 + 0.15);
  armL.material = armMat;
  armL.isPickable = false;

  const armR = armL.clone('player_blocky_arm_r');
  armR.parent = root;
  armR.position.x = bodyWidth / 2 + 0.15;

  const fullHeight = legHeight + bodyHeight + headSize * 1.2;
  return {
    root,
    height: fullHeight,
    anchorYOffset: fullHeight / 2,
  };
}

function createCapsuleSkin(scene: BABYLON.Scene, colors?: PlayerSkinColors): PlayerSkinInstance {
  const root = new BABYLON.Mesh('player_root_capsule', scene);
  root.isPickable = false;

  const height = 1.8;
  const diameter = 0.9;
  const body = BABYLON.MeshBuilder.CreateCylinder('player_capsule', { height, diameter }, scene);
  const mat = new BABYLON.StandardMaterial('player_capsule_mat', scene);
  mat.diffuseColor = colors?.primary ?? new BABYLON.Color3(0.2, 0.5, 0.8);
  mat.specularColor = new BABYLON.Color3(0, 0, 0);
  body.material = mat;
  body.parent = root;
  body.isPickable = false;

  return {
    root,
    height,
    anchorYOffset: height / 2,
  };
}

function createRobotSkin(scene: BABYLON.Scene, colors?: PlayerSkinColors): PlayerSkinInstance {
  const root = new BABYLON.Mesh('player_root_robot', scene);
  root.isPickable = false;

  const mat = new BABYLON.PBRMaterial('player_robot_mat', scene);
  mat.metallic = 0.4;
  mat.roughness = 0.4;
  mat.albedoColor = colors?.primary ?? new BABYLON.Color3(0.8, 0.8, 0.85);

  // Torso
  const torso = BABYLON.MeshBuilder.CreateBox('player_robot_torso', { width: 0.9, height: 1.1, depth: 0.5 }, scene);
  torso.material = mat;
  torso.parent = root;
  torso.position.y = 0.6 + 0.55;
  torso.isPickable = false;

  // Head
  const head = BABYLON.MeshBuilder.CreateBox('player_robot_head', { width: 0.5, height: 0.4, depth: 0.4 }, scene);
  head.material = mat;
  head.parent = root;
  head.position.y = 0.6 + 1.1 + 0.25;
  head.isPickable = false;

  // Legs
  const leg = BABYLON.MeshBuilder.CreateCylinder('player_robot_leg_l', { diameter: 0.22, height: 0.6, tessellation: 8 }, scene);
  leg.material = mat;
  leg.parent = root;
  leg.position.y = 0.3;
  leg.position.x = -0.22;
  leg.isPickable = false;
  const legR = leg.clone('player_robot_leg_r');
  legR.parent = root;
  legR.position.x = 0.22;

  // Arms
  const arm = BABYLON.MeshBuilder.CreateCylinder('player_robot_arm_l', { diameter: 0.18, height: 0.7, tessellation: 8 }, scene);
  arm.material = mat;
  arm.parent = root;
  arm.position.y = 0.6 + 0.5;
  arm.position.x = -0.6;
  arm.rotation.z = Math.PI / 2.2;
  arm.isPickable = false;
  const armR = arm.clone('player_robot_arm_r');
  armR.parent = root;
  armR.position.x = 0.6;

  const height = 0.6 + 1.1 + 0.5 + 0.05;
  return {
    root,
    height,
    anchorYOffset: height / 2,
  };
}

function createKogamaSkin(scene: BABYLON.Scene, colors?: PlayerSkinColors, cfg?: PlayerSkinConfig): PlayerSkinInstance {
  const root = new BABYLON.Mesh('player_root_kogama', scene);
  root.isPickable = false;

  const primary = colors?.primary ?? new BABYLON.Color3(0.25, 0.6, 0.95);
  const secondary = colors?.secondary ?? new BABYLON.Color3(0.9, 0.9, 0.95);
  const tertiary = colors?.tertiary ?? new BABYLON.Color3(1.0, 0.85, 0.2);

  const bodyType = cfg?.bodyType || 'normal';
  const headType = cfg?.headType || 'cube';
  const limbStyle = cfg?.limbStyle || 'block';
  const accessoryHat = cfg?.accessoryHat || 'none';
  const accessoryBack = cfg?.accessoryBack || 'none';
  const faceEyes = cfg?.face?.eyes || 'dot';
  const faceMouth = cfg?.face?.mouth || 'smile';

  // Dimensions derived from body type
  const torsoWidth = bodyType === 'slim' ? 0.7 : bodyType === 'bulk' ? 1.1 : 0.9;
  const torsoHeight = 1.1;
  const torsoDepth = 0.45;
  const legHeight = 0.6;
  const legThickness = bodyType === 'bulk' ? 0.3 : 0.24;
  const armLength = 0.7;
  const armThickness = bodyType === 'bulk' ? 0.24 : 0.2;

  // Materials
  const matPrimary = new BABYLON.PBRMaterial('kogama_primary_mat', scene);
  matPrimary.metallic = 0.0; matPrimary.roughness = 0.6; matPrimary.albedoColor = primary;
  const matSecondary = new BABYLON.PBRMaterial('kogama_secondary_mat', scene);
  matSecondary.metallic = 0.0; matSecondary.roughness = 0.6; matSecondary.albedoColor = secondary;
  const matAccent = new BABYLON.PBRMaterial('kogama_accent_mat', scene);
  matAccent.metallic = 0.0; matAccent.roughness = 0.5; matAccent.albedoColor = tertiary;

  // Torso
  const torso = BABYLON.MeshBuilder.CreateBox('kogama_torso', { width: torsoWidth, height: torsoHeight, depth: torsoDepth }, scene);
  torso.material = matPrimary; torso.parent = root; torso.position.y = legHeight + torsoHeight / 2; torso.isPickable = false;

  // Head
  let head: BABYLON.Mesh;
  if (headType === 'rounded') {
    head = BABYLON.MeshBuilder.CreateSphere('kogama_head_round', { diameter: 0.52, segments: 16 }, scene);
  } else if (headType === 'capsule') {
    head = BABYLON.MeshBuilder.CreateCapsule('kogama_head_capsule', { height: 0.55, radius: 0.23, tessellation: 12 }, scene) as BABYLON.Mesh;
  } else {
    head = BABYLON.MeshBuilder.CreateBox('kogama_head_cube', { size: 0.5 }, scene);
  }
  head.material = matPrimary; head.parent = root; head.position.y = legHeight + torsoHeight + 0.32; head.isPickable = false;

  // Legs
  if (limbStyle === 'cylinder') {
    const legL = BABYLON.MeshBuilder.CreateCylinder('kogama_leg_l', { diameter: legThickness, height: legHeight, tessellation: 12 }, scene);
    legL.material = matSecondary; legL.parent = root; legL.position.y = legHeight / 2; legL.position.x = -torsoWidth * 0.25; legL.isPickable = false;
    const legR = legL.clone('kogama_leg_r'); legR.parent = root; legR.position.x = torsoWidth * 0.25;
  } else {
    const legL = BABYLON.MeshBuilder.CreateBox('kogama_leg_l', { width: legThickness, height: legHeight, depth: legThickness }, scene);
    legL.material = matSecondary; legL.parent = root; legL.position.y = legHeight / 2; legL.position.x = -torsoWidth * 0.25; legL.isPickable = false;
    const legR = legL.clone('kogama_leg_r'); legR.parent = root; legR.position.x = torsoWidth * 0.25;
  }

  // Arms
  if (limbStyle === 'cylinder') {
    const armL = BABYLON.MeshBuilder.CreateCylinder('kogama_arm_l', { diameter: armThickness, height: armLength, tessellation: 12 }, scene);
    armL.material = matSecondary; armL.parent = root; armL.position.y = legHeight + torsoHeight * 0.6; armL.position.x = -(torsoWidth / 2 + armThickness * 1.2); armL.rotation.z = Math.PI / 2.15; armL.isPickable = false;
    const armR = armL.clone('kogama_arm_r'); armR.parent = root; armR.position.x = torsoWidth / 2 + armThickness * 1.2;
  } else {
    const armL = BABYLON.MeshBuilder.CreateBox('kogama_arm_l', { width: armThickness, height: armLength, depth: armThickness }, scene);
    armL.material = matSecondary; armL.parent = root; armL.position.y = legHeight + torsoHeight * 0.6; armL.position.x = -(torsoWidth / 2 + armThickness * 1.2); armL.rotation.z = Math.PI / 2.15; armL.isPickable = false;
    const armR = armL.clone('kogama_arm_r'); armR.parent = root; armR.position.x = torsoWidth / 2 + armThickness * 1.2;
  }

  // Face: simple eyes/mouth geometry
  if (faceEyes !== 'none') {
    if (faceEyes === 'dot' || faceEyes === 'cartoon') {
      const eyeL = BABYLON.MeshBuilder.CreateSphere('kogama_eye_l', { diameter: faceEyes === 'cartoon' ? 0.08 : 0.06, segments: 8 }, scene);
      const eyeR = eyeL.clone('kogama_eye_r');
      const eyeMat = new BABYLON.StandardMaterial('kogama_eye_mat', scene);
      eyeMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.08);
      eyeL.material = eyeMat; eyeR.material = eyeMat;
      eyeL.parent = head; eyeR.parent = head;
      eyeL.position.set(-0.12, 0.05, headType === 'cube' ? 0.27 : 0.26);
      eyeR.position.set(0.12, 0.05, headType === 'cube' ? 0.27 : 0.26);
      eyeL.isPickable = false; eyeR.isPickable = false;
    } else if (faceEyes === 'robot') {
      const visor = BABYLON.MeshBuilder.CreateBox('kogama_visor', { width: 0.36, height: 0.14, depth: 0.04 }, scene);
      visor.material = matAccent; visor.parent = head; visor.position.set(0, 0.02, headType === 'cube' ? 0.27 : 0.26); visor.isPickable = false;
    }
  }
  if (faceMouth && faceMouth !== 'none') {
    const mouth = BABYLON.MeshBuilder.CreateTorus('kogama_mouth', { diameter: 0.18, thickness: 0.02, tessellation: 10 }, scene);
    mouth.parent = head; mouth.material = matAccent; mouth.rotation.x = Math.PI / 2; mouth.position.set(0, -0.12, headType === 'cube' ? 0.25 : 0.24); mouth.isPickable = false;
    if (faceMouth === 'smile') {
      mouth.rotation.z = Math.PI / 10;
    }
  }

  // Accessories
  if (accessoryHat !== 'none') {
    if (accessoryHat === 'cap') {
      const cap = BABYLON.MeshBuilder.CreateCylinder('kogama_cap', { diameter: 0.55, height: 0.12, tessellation: 16 }, scene);
      cap.material = matAccent; cap.parent = head; cap.position.y = headType === 'cube' ? 0.28 : 0.3; cap.isPickable = false;
    } else if (accessoryHat === 'topHat') {
      const brim = BABYLON.MeshBuilder.CreateCylinder('kogama_hat_brim', { diameter: 0.6, height: 0.04, tessellation: 16 }, scene);
      brim.material = matAccent; brim.parent = head; brim.position.y = headType === 'cube' ? 0.28 : 0.3; brim.isPickable = false;
      const crown = BABYLON.MeshBuilder.CreateCylinder('kogama_hat_crown', { diameter: 0.36, height: 0.24, tessellation: 16 }, scene);
      crown.material = matAccent; crown.parent = head; crown.position.y = (headType === 'cube' ? 0.28 : 0.3) + 0.14; crown.isPickable = false;
    }
  }

  if (accessoryBack !== 'none') {
    if (accessoryBack === 'backpack') {
      const pack = BABYLON.MeshBuilder.CreateBox('kogama_backpack', { width: 0.4, height: 0.5, depth: 0.18 }, scene);
      pack.material = matAccent; pack.parent = torso; pack.position.set(0, 0.05, -torsoDepth / 2 - 0.1); pack.isPickable = false;
    } else if (accessoryBack === 'cape') {
      const cape = BABYLON.MeshBuilder.CreatePlane('kogama_cape', { width: torsoWidth * 0.9, height: 0.9 }, scene);
      cape.material = matAccent; cape.parent = torso; cape.position.set(0, 0.2, -torsoDepth / 2 - 0.02); cape.rotation.x = Math.PI / 16; cape.isPickable = false;
    }
  }

  const height = legHeight + torsoHeight + 0.5 * 1.1; // approx
  return {
    root,
    height,
    anchorYOffset: height / 2,
  };
}


