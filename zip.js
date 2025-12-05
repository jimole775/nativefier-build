#!/usr/bin/env node
import { spawn } from 'child_process';
import { resolve } from 'path';

/**
 * 检测命令是否存在
 * @param {string} command - 要检测的命令
 * @returns {Promise<boolean>} - 命令是否存在
 */
const commandExists = (command) => {
  return new Promise((resolve) => {
    const childProcess = spawn(command, ['--version'], {
      shell: true,
      stdio: 'ignore',
      env: process.env
    });
    
    childProcess.on('close', (code) => {
      resolve(code === 0);
    });
    
    childProcess.on('error', () => {
      resolve(false);
    });
  });
};

/**
 * 将指定目录打包成压缩文件，支持多种格式
 * @param {string} sourcePath - 要打包的源目录路径
 * @param {string} outputPath - 输出的压缩文件路径
 * @param {string} format - 压缩格式：zip, 7z, tar, tar.gz, tar.bz2, tar.xz
 * @returns {Promise<boolean>} - 打包是否成功
 */
export const zipDirectory = async (sourcePath, outputPath, format = 'zip') => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`\n开始打包成 ${format} 文件...`);
      
      // 检测可用的压缩命令
      const isZipAvailable = await commandExists('zip');
      const is7zAvailable = await commandExists('7z');
      const isTarAvailable = await commandExists('tar');
      
      // 根据格式和系统选择合适的命令
      let compressCommand, compressArgs;
      
      switch (format) {
        case '7z':
          if (is7zAvailable) {
            compressCommand = '7z';
            compressArgs = [
              'a',
              '-t7z',
              outputPath,
              sourcePath
            ];
          } else {
            console.log('⚠️  7z 命令不可用，尝试使用 zip 格式');
            format = 'zip';
            // 继续执行，使用 zip 格式
          }
          break;
          
        case 'tar':
        case 'tar.gz':
        case 'tar.bz2':
        case 'tar.xz':
          if (isTarAvailable) {
            compressCommand = 'tar';
            const tarArgs = ['-c', '-f', outputPath, '--exclude', '*.tar*', '--exclude', '*.zip', '--exclude', '*.7z'];
            
            // 根据压缩格式添加相应的参数
            switch (format) {
              case 'tar.gz':
                tarArgs.push('-z');
                break;
              case 'tar.bz2':
                tarArgs.push('-j');
                break;
              case 'tar.xz':
                tarArgs.push('-J');
                break;
            }
            
            tarArgs.push(sourcePath);
            compressArgs = tarArgs;
          } else {
            console.log('⚠️  tar 命令不可用，尝试使用 zip 格式');
            format = 'zip';
            // 继续执行，使用 zip 格式
          }
          break;
          
        case 'zip':
        default:
          // 根据不同操作系统选择不同的 zip 命令
          if (process.platform === 'win32') {
            // Windows 系统，优先使用 PowerShell 的 Compress-Archive 命令
            compressCommand = 'powershell';
            compressArgs = [
              '-Command',
              `try { Compress-Archive -Path '${sourcePath}' -DestinationPath '${outputPath}' -Force -ErrorAction Stop; Write-Host "✅ zip 打包成功！"; exit 0 } catch { Write-Host "⚠️  zip 打包失败：$($_.Exception.Message)"; exit 1 }`
            ];
          } else if (isZipAvailable) {
            // Linux/macOS 系统，使用 zip 命令
            compressCommand = 'zip';
            compressArgs = [
              '-r',
              outputPath,
              sourcePath
            ];
          } else if (is7zAvailable) {
            // 尝试使用 7z 命令
            compressCommand = '7z';
            compressArgs = [
              'a',
              '-tzip',
              outputPath,
              sourcePath
            ];
          } else {
            console.log('⚠️  没有可用的压缩命令');
            resolve(false);
            return;
          }
          break;
      }
      
      console.log(`执行命令：${compressCommand} ${compressArgs.join(' ')}`);
      
      // 执行压缩命令
      const compressProcess = spawn(compressCommand, compressArgs, {
        shell: true,
        stdio: 'inherit',
        env: process.env
      });
      
      compressProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${format} 打包成功！`);
          console.log(`打包文件：${outputPath}`);
          resolve(true);
        } else {
          console.log(`⚠️  ${format} 打包失败，可能是命令不可用或权限问题`);
          console.log(`⚠️  构建结果已输出到 ${sourcePath} 目录，您可以手动打包`);
          resolve(false);
        }
      });
      
      compressProcess.on('error', (err) => {
        console.log(`⚠️  ${format} 命令执行错误：${err.message}`);
        console.log(`⚠️  构建结果已输出到 ${sourcePath} 目录，您可以手动打包`);
        resolve(false);
      });
    } catch (err) {
      console.log(`⚠️  ${format} 打包过程中发生异常：${err.message}`);
      console.log(`⚠️  构建结果已输出到 ${sourcePath} 目录，您可以手动打包`);
      resolve(false);
    }
  });
};
