#!/usr/bin/env node
import { spawn } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { zipDirectory } from './zip.js';

// 定义环境配置
const envConfig = {
  prod: {
    name: 'baidu-prod',
    url: 'https://www.baidu.com/prod'
  },
  uat: {
    name: 'baidu-uat',
    url: 'https://www.baidu.com/uat'
  },
  sit: {
    name: 'baidu-sit',
    url: 'https://www.baidu.com/sit'
  }
};

const archMap = {
  32: ['ia32'],
  64: ['x64', 'arm64']
};

// 解析命令行参数
const args = process.argv.slice(2);
let envs = ['prod', 'uat', 'sit']; // 默认构建全部环境
let arches = [32, 64]; // 默认构建全部架构
let format = 'zip'; // 默认压缩格式
let platform = process.platform; // 默认使用当前系统平台

// 保存当前 Node.js 版本，用于构建完成后切回
let originalNodeVersion = '';

// 支持的平台列表
const supportedPlatforms = ['windows', 'darwin', 'linux'];

// 解析命令行选项
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--env') {
    if (i + 1 < args.length) {
      const envArg = args[i + 1];
      // 支持逗号分隔的多个环境，如 --env sit,uat
      envs = envArg.split(',').filter(env => envConfig[env]);
      // 如果没有有效的环境，使用默认值
      if (envs.length === 0) {
        envs = ['prod', 'uat', 'sit'];
      }
      i++;
    }
  } else if (args[i] === '--arch') {
    if (i + 1 < args.length) {
      const archArg = args[i + 1];
      // 支持逗号分隔的多个架构，如 --arch 32,64
      const archValues = archArg.split(',').map(a => parseInt(a, 10)).filter(a => !isNaN(a) && [32, 64].includes(a));
      if (archValues.length > 0) {
        arches = archValues;
      } else {
        console.log(`⚠️  无效的架构参数，使用默认值：32,64`);
      }
      i++;
    }
  } else if (args[i] === '--format') {
    if (i + 1 < args.length) {
      const formatArg = args[i + 1];
      // 支持的压缩格式
      const supportedFormats = ['zip', '7z', 'tar', 'tar.gz', 'tar.bz2', 'tar.xz'];
      if (supportedFormats.includes(formatArg)) {
        format = formatArg;
      } else {
        console.log(`⚠️  不支持的压缩格式：${formatArg}，使用默认格式 zip`);
      }
      i++;
    }
  } else if (args[i] === '--platform') {
    if (i + 1 < args.length) {
      const platformArg = args[i + 1];
      // 支持的平台：windows, darwin, linux
      if (supportedPlatforms.includes(platformArg)) {
        platform = platformArg;
      } else {
        console.log(`⚠️  不支持的平台：${platformArg}，使用默认平台：${platform}`);
      }
      i++;
    }
  }
}

// 设置环境变量
process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';

// 确保输出目录存在
if (!existsSync('apps')) {
  mkdirSync('apps', { recursive: true });
  console.log('创建输出目录：apps');
}

// 获取并保存当前 Node.js 版本
const getCurrentNodeVersion = () => {
  return new Promise((resolve) => {
    const nodeVersion = spawn('node', ['--version'], {
      shell: true,
      stdio: 'pipe'
    });
    
    let version = '';
    
    nodeVersion.stdout.on('data', (data) => {
      version += data.toString().trim();
    });
    
    nodeVersion.on('close', (code) => {
      if (code === 0) {
        resolve(version.replace('v', '')); // 移除 'v' 前缀
      } else {
        resolve('');
      }
    });
  });
};

// 保存当前 Node.js 版本，然后执行 nvm use 16
const saveOriginalVersionAndUse16 = async () => {
  originalNodeVersion = await getCurrentNodeVersion();
  console.log(`当前 Node.js 版本：v${originalNodeVersion}`);
  console.log(`切换到 Node.js v16...`);
  
  const nvmUse = spawn('nvm', ['use', '16'], {
    shell: true,
    stdio: 'inherit'
  });
  
  nvmUse.on('close', async (code) => {
    if (code !== 0) {
      console.error(`nvm use 16 执行失败，退出码：${code}`);
      process.exit(code);
      return;
    }
    
    // 构建完成后切回原始版本的逻辑将在后面添加
    await buildProcess();
  });
};

// 构建过程
const buildProcess = async () => {
  
  // 定义输出目录
  const appsPath = resolve('apps');
  
  // 顺序构建每个环境和架构，避免并行冲突
for (let i = 0; i < envs.length; i++) {
  const envItem = envs[i];
  const config = envConfig[envItem];
  
  // 遍历所有指定的架构（如 32, 64）
  for (let j = 0; j < arches.length; j++) {
    const arch = arches[j];
    // 获取当前架构对应的实际架构类型数组（如 64 => ['x64', 'arm64']）
    const archTypes = archMap[arch] || [];
    
    // 遍历所有实际架构类型
    for (let k = 0; k < archTypes.length; k++) {
      const archType = archTypes[k];
      
      // 创建架构子目录
      const archDir = `${appsPath}/${archType}`;
      if (!existsSync(archDir)) {
        mkdirSync(archDir, { recursive: true });
        console.log(`创建架构目录：${archDir}`);
      }
      
      // 构建 nativefier 命令
      const nativefierArgs = [
        '--name', config.name,
        '--icon', '/assets/logo.ico',
        '--inject', '/inject/zoom.js',
        '--electron-version', '19.1.4',
        '--app-copyright', 'xxx公司',
        '--disable-dev-tools',
        '--clear-cache',
        '--always-on-top',
        '--full-screen',
        '--platform', platform,
        '--arch', archType,
        '--verbose', // 增加详细日志
        '--',
        config.url,
        archDir // 使用架构子目录作为输出目录
      ];

      console.log('\n正在执行 nativefier 构建...');
      console.log(`环境：${envItem}`);
      console.log(`平台：${platform}`);
      console.log(`架构：${arch}位 (${archType})`);
      console.log(`应用名称：${config.name}`);
      console.log(`URL：${config.url}`);
      console.log(`输出目录：${archDir}`);
      console.log(`命令：nativefier ${nativefierArgs.join(' ')}`);

      // 等待当前构建完成后再进行下一个
      await new Promise((resolve, reject) => {
        // 执行 nativefier 命令
        const nativefier = spawn('nativefier', nativefierArgs, {
          shell: true,
          stdio: 'inherit',
          env: process.env
        });
        
        nativefier.on('close', (code) => {
          if (code !== 0) {
            console.error(`nativefier 执行失败，退出码：${code}`);
            reject(new Error(`nativefier 执行失败，退出码：${code}`));
            return;
          }
          
          console.log(`构建成功！环境：${envItem}，架构：${arch}位 (${archType})`);
          resolve(true);
        });
        
        nativefier.on('error', (err) => {
          console.error('nativefier 命令执行错误：', err);
          reject(err);
        });
      }).then(async () => {
        // 构建完成后，对当前项目进行单独打包
        const appDir = `${archDir}/${config.name}-win32-${archType}`;
        const zipPath = `${archDir}/${config.name}-win32-${archType}.${format}`;
        
        if (existsSync(appDir)) {
          await zipDirectory(appDir, zipPath, format);
        } else {
          console.log(`⚠️  未找到构建目录：${appDir}，跳过打包`);
        }
      }).catch((err) => {
        console.error('构建过程中发生错误：', err);
        process.exit(1);
      });
    }
  }
}
  
  console.log('\n所有环境构建完成！');
  
  // 所有项目已单独打包完成
  console.log('\n✅ 构建和打包流程已完成！');
  console.log(`构建结果已输出到 ${appsPath} 目录`);
  
  // 切回原始 Node.js 版本
  if (originalNodeVersion) {
    console.log(`\n切换回原始 Node.js 版本 v${originalNodeVersion}...`);
    const nvmUseOriginal = spawn('nvm', ['use', originalNodeVersion], {
      shell: true,
      stdio: 'inherit'
    });
    
    nvmUseOriginal.on('close', (code) => {
      if (code !== 0) {
        console.error(`切换回原始 Node.js 版本失败，退出码：${code}`);
        process.exit(code);
        return;
      }
      
      console.log(`✅ 已切换回 Node.js v${originalNodeVersion}`);
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

// 开始执行
console.log('准备开始构建...');
saveOriginalVersionAndUse16();
