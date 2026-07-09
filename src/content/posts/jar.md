---
title: windows环境jar包自启动
published: 2026-07-09
description: 这是一篇介绍如何在windows环境下实现jar包自启动的文章
image: ./cover.jpg
tags: [开发]
category: 文档类
draft: false
---

## java项目打包可执行文件jar的自启动说明
### 1、注册软件下载安装
下载地址：https://nssm.cc/download
### 2、准备jar包的批处理文件（.bat）
编写jar包启动的脚本文件
### 3、安装成服务
打开cmd命令提示符，进入nssm.exe同级目录 （根据电脑32位，或64位选择进入对应的目录）
注入服务，命令行键入如下命令，并会弹出如下图选择框
```
nssm install RocketMQ_Dashboard
```
Path设置，选中指定文件夹内的jar包启动脚本.bat文件
点击install service即可完成安装
### 4、检查服务
打开windows服务，启动RocketMQ_Dashboard服务即可